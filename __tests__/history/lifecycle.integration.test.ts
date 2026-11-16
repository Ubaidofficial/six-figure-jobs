// Runs the lifecycle SQL against a real Postgres. Skipped unless HISTORY_TEST_DATABASE_URL is set (CI has no database); it
// refuses any database whose name does not contain "test", because it empties the tables it uses.
//
//   HISTORY_TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/sixfig_test npx jest __tests__/history
import { PrismaClient } from '@prisma/client'

import { observeJobLifecycle } from '../../lib/history/lifecycle'

const url = process.env.HISTORY_TEST_DATABASE_URL
const suite = url ? describe : describe.skip

suite('observeJobLifecycle (real Postgres)', () => {
  let db: PrismaClient

  beforeAll(async () => {
    if (!/test/i.test(new URL(url as string).pathname)) throw new Error('Refusing: the database name must contain "test".')
    db = new PrismaClient({ datasourceUrl: url })
    await db.$executeRawUnsafe('TRUNCATE "JobLifecycle", "Job" CASCADE')
  })
  afterAll(async () => {
    await db?.$disconnect()
  })

  const job = (id: string, over: Record<string, unknown> = {}) =>
    db.job.create({
      data: { id, title: `Job ${id}`, company: 'Acme', source: 'ats:test', minAnnual: 100000n, maxAnnual: 120000n, currency: 'USD', roleSlug: 'engineer', countryCode: 'US', isExpired: false, ...over },
    })
  const row = (id: string) => db.jobLifecycle.findUnique({ where: { jobId: id } })

  it('tracks live jobs only, and a dry run writes nothing', async () => {
    await job('a')
    await job('b')
    await job('c', { isExpired: true })

    const dry = await observeJobLifecycle(db, { apply: false })
    expect(dry.toTrack).toBe(2)
    expect(await db.jobLifecycle.count()).toBe(0)

    await observeJobLifecycle(db, { apply: true })
    expect(await db.jobLifecycle.count()).toBe(2)
    expect(await row('c')).toBeNull() // already expired before the first run: when it expired is unknown, so not tracked
    const a = await row('a')
    expect(a).toMatchObject({ source: 'ats:test', company: 'Acme', roleSlug: 'engineer', countryCode: 'US', reopenCount: 0, payChangeCount: 0, expiredObservedAt: null })
    expect(a?.lastMinAnnual).toBe(100000n)
  })

  it('records a pay change with the new figures, and nothing for an unchanged job', async () => {
    await db.job.update({ where: { id: 'a' }, data: { minAnnual: 110000n, maxAnnual: 130000n } })
    const preview = await observeJobLifecycle(db, { apply: false })
    expect(preview.payChanged).toBe(1)

    await observeJobLifecycle(db, { apply: true })
    const a = await row('a')
    expect(a?.payChangeCount).toBe(1)
    expect(a?.lastMinAnnual).toBe(110000n)
    expect(a?.payHistory).toEqual([expect.objectContaining({ min: 110000, max: 130000, currency: 'USD' })])
    expect((await row('b'))?.payChangeCount).toBe(0)

    await observeJobLifecycle(db, { apply: true }) // same pay again: no second entry
    expect((await row('a'))?.payChangeCount).toBe(1)
  })

  it('notes the first run that saw a job expired, then counts a reopen when it is live again', async () => {
    await db.job.update({ where: { id: 'b' }, data: { isExpired: true } })
    await observeJobLifecycle(db, { apply: true })
    const gone = await row('b')
    expect(gone?.expiredObservedAt).toBeInstanceOf(Date)
    const firstSeen = gone?.expiredObservedAt?.getTime()

    await observeJobLifecycle(db, { apply: true }) // still expired: the first sighting is kept
    expect((await row('b'))?.expiredObservedAt?.getTime()).toBe(firstSeen)

    await db.job.update({ where: { id: 'b' }, data: { isExpired: false } })
    await observeJobLifecycle(db, { apply: true })
    expect(await row('b')).toMatchObject({ expiredObservedAt: null, reopenCount: 1 })
  })

  it('keeps the history of a job whose Job row is deleted', async () => {
    await db.job.delete({ where: { id: 'a' } })
    const counts = await observeJobLifecycle(db, { apply: true })
    expect(counts.goneFromJobTable).toBe(1)
    expect((await row('a'))?.payChangeCount).toBe(1)
  })

  it('keeps only the newest 20 pay changes', async () => {
    await job('p')
    await observeJobLifecycle(db, { apply: true })
    for (let i = 0; i < 25; i++) {
      await db.job.update({ where: { id: 'p' }, data: { minAnnual: BigInt(200000 + i * 1000) } })
      await observeJobLifecycle(db, { apply: true })
    }
    const p = await row('p')
    expect(p?.payChangeCount).toBe(25)
    const history = p?.payHistory as Array<{ min: number }>
    expect(history).toHaveLength(20)
    expect(history[0].min).toBe(205000) // the five oldest were dropped
    expect(history[19].min).toBe(224000)
  })
})
