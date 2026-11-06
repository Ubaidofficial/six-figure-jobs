import { CreditsError, clawbackCredits, getBalance, grantCredits, spendCredits } from '@/lib/billing/credits'

import { createFakePrisma } from './fakePrisma'

function setup(opts: { lock?: boolean } = {}) {
  const fake = createFakePrisma(opts)
  fake.addUser('u1')
  fake.addUser('u2')
  const db = fake.prisma as any
  const grant = (userId: string, credits: number, key: string) =>
    db.$transaction((tx: any) =>
      grantCredits(tx, { userId, credits, kind: 'pack', reason: 'pack:test', refId: `pi_${key}`, idempotencyKey: key }),
    )
  return { fake, db, grant }
}

describe('spendCredits', () => {
  it('deducts when the balance covers it and records a spend row', async () => {
    const { fake, db, grant } = setup()
    await grant('u1', 10, 'g1')
    const r = await spendCredits('u1', 'resume_review', 4, 'spend-1', db)
    expect(r).toEqual({ ok: true, balance: 6, replayed: false })
    expect(fake.balance('u1')).toBe(6)
    const row = fake.tables.creditLedger.find((x) => x.idempotencyKey === 'spend-1')!
    expect(row).toMatchObject({ kind: 'spend', reason: 'resume_review', delta: -4, userId: 'u1' })
  })

  it('refuses without writing anything when the balance is too low', async () => {
    const { fake, db, grant } = setup()
    await grant('u1', 3, 'g1')
    const r = await spendCredits('u1', 'x', 5, 'spend-1', db)
    expect(r).toEqual({ ok: false, reason: 'insufficient_credits', balance: 3 })
    expect(fake.tables.creditLedger).toHaveLength(1)
  })

  it('is idempotent: the same key twice deducts once and reports a replay', async () => {
    const { fake, db, grant } = setup()
    await grant('u1', 10, 'g1')
    await spendCredits('u1', 'x', 4, 'k', db)
    const again = await spendCredits('u1', 'x', 4, 'k', db)
    expect(again).toEqual({ ok: true, balance: 6, replayed: true })
    expect(fake.balance('u1')).toBe(6)
  })

  it('rejects a key reused for a different amount or by a different user', async () => {
    const { db, grant } = setup()
    await grant('u1', 10, 'g1')
    await grant('u2', 10, 'g2')
    await spendCredits('u1', 'x', 4, 'k', db)
    await expect(spendCredits('u1', 'x', 5, 'k', db)).rejects.toMatchObject({ code: 'idempotency_conflict' })
    await expect(spendCredits('u2', 'x', 4, 'k', db)).rejects.toMatchObject({ code: 'idempotency_conflict' })
  })

  it('never lets concurrent spends take the balance below zero', async () => {
    const { fake, db, grant } = setup()
    await grant('u1', 10, 'g1')
    // 25 simultaneous spends of 1 against a balance of 10, each with its own key.
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => spendCredits('u1', 'x', 1, `spend-${i}`, db)))
    expect(results.filter((r) => r.ok)).toHaveLength(10)
    expect(results.filter((r) => !r.ok)).toHaveLength(15)
    expect(fake.balance('u1')).toBe(0)
  })

  it('concurrent spends of different sizes still sum to at most the balance', async () => {
    const { fake, db, grant } = setup()
    await grant('u1', 10, 'g1')
    const amounts = [3, 3, 3, 3, 3, 2, 2, 2]
    const results = await Promise.all(amounts.map((a, i) => spendCredits('u1', 'x', a, `s-${i}`, db)))
    const spent = results.reduce((s, r, i) => s + (r.ok ? amounts[i] : 0), 0)
    expect(spent).toBeLessThanOrEqual(10)
    expect(fake.balance('u1')).toBe(10 - spent)
    expect(fake.balance('u1')).toBeGreaterThanOrEqual(0)
  })

  it('concurrent retries of the SAME key deduct exactly once', async () => {
    const { fake, db, grant } = setup()
    await grant('u1', 10, 'g1')
    const results = await Promise.all(Array.from({ length: 8 }, () => spendCredits('u1', 'x', 4, 'same-key', db)))
    expect(results.every((r) => r.ok)).toBe(true)
    expect(results.filter((r) => r.ok && !r.replayed)).toHaveLength(1)
    expect(fake.balance('u1')).toBe(6)
  })

  it('spends of one user do not block or affect another', async () => {
    const { fake, db, grant } = setup()
    await grant('u1', 2, 'g1')
    await grant('u2', 2, 'g2')
    await Promise.all([spendCredits('u1', 'x', 2, 'a', db), spendCredits('u2', 'x', 2, 'b', db)])
    expect(fake.balance('u1')).toBe(0)
    expect(fake.balance('u2')).toBe(0)
  })

  it('the test has teeth: without the row lock the same race drives the balance negative', async () => {
    const { fake, db, grant } = setup({ lock: false })
    await grant('u1', 10, 'g1')
    await Promise.all(Array.from({ length: 25 }, (_, i) => spendCredits('u1', 'x', 1, `spend-${i}`, db)))
    expect(fake.balance('u1')).toBeLessThan(0)
  })

  it('throws for an unknown user and writes nothing', async () => {
    const { fake, db } = setup()
    await expect(spendCredits('ghost', 'x', 1, 'k', db)).rejects.toMatchObject({ code: 'user_not_found' })
    expect(fake.tables.creditLedger).toHaveLength(0)
  })

  it.each([
    ['zero amount', 0, 'x', 'k'],
    ['negative amount', -1, 'x', 'k'],
    ['fractional amount', 1.5, 'x', 'k'],
    ['NaN', Number.NaN, 'x', 'k'],
    ['huge amount', 10_000_000, 'x', 'k'],
    ['bad kind', 1, 'has space', 'k'],
    ['empty key', 1, 'x', ''],
    ['key with control characters', 1, 'x', 'a\nb'],
  ])('rejects invalid input: %s', async (_name, amount, kind, key) => {
    const { db, grant } = setup()
    await grant('u1', 10, 'g1')
    await expect(spendCredits('u1', kind, amount as number, key, db)).rejects.toBeInstanceOf(CreditsError)
  })
})

describe('grantCredits', () => {
  it('writes once per idempotency key', async () => {
    const { fake, grant } = setup()
    expect(await grant('u1', 5, 'same')).toBe(true)
    expect(await grant('u1', 5, 'same')).toBe(false)
    expect(fake.balance('u1')).toBe(5)
  })

  it('refuses zero, negative and fractional grants', async () => {
    const { db } = setup()
    for (const credits of [0, -3, 1.2]) {
      await expect(
        db.$transaction((tx: any) =>
          grantCredits(tx, { userId: 'u1', credits, kind: 'pack', reason: 'r', refId: 'x', idempotencyKey: `k${credits}` }),
        ),
      ).rejects.toBeInstanceOf(CreditsError)
    }
  })
})

describe('clawbackCredits', () => {
  const claw = (db: any, target: number, key: string) =>
    db.$transaction((tx: any) =>
      clawbackCredits(tx, { userId: 'u1', refId: 'pi_1', target, reason: 'charge_refunded', idempotencyKey: key }),
    )

  it('takes back what is wanted when the balance allows', async () => {
    const { fake, db, grant } = setup()
    await grant('u1', 10, 'g1')
    expect(await claw(db, 4, 'r1')).toBe(4)
    expect(fake.balance('u1')).toBe(6)
  })

  it('is capped at the balance: it can never push the balance below zero', async () => {
    const { fake, db, grant } = setup()
    await grant('u1', 10, 'g1')
    await spendCredits('u1', 'x', 8, 's1', db)
    expect(await claw(db, 10, 'r1')).toBe(2)
    expect(fake.balance('u1')).toBe(0)
  })

  it('subtracts what an earlier refund of the same payment already took, and is idempotent', async () => {
    const { fake, db, grant } = setup()
    await grant('u1', 10, 'g1')
    expect(await claw(db, 3, 'r1')).toBe(3)
    expect(await claw(db, 3, 'r1')).toBe(3) // replay of the same event: no second deduction
    expect(await claw(db, 5, 'r2')).toBe(2) // cumulative target 5, 3 already taken
    expect(fake.balance('u1')).toBe(5)
  })
})

describe('getBalance', () => {
  it('is the sum of the ledger, 0 for a new user', async () => {
    const { fake, grant } = setup()
    expect(await getBalance('u1', fake.prisma as any)).toBe(0)
    await grant('u1', 7, 'g1')
    expect(await getBalance('u1', fake.prisma as any)).toBe(7)
  })
})
