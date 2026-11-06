import { createFakePrisma } from '../billing/fakePrisma'

let mockDb: any
jest.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => mockDb[k] }) }))

import { generateKit, KitError } from '@/lib/applykit/generate'
import { grantCredits } from '@/lib/billing/credits'

const letter = 'Dear hiring team, '.padEnd(200, 'I would love to help. ')
const reply = JSON.stringify({ coverLetter: letter, bullets: ['Built X'], keywordGaps: ['Go'] })
const job = { id: 'job1', title: 'Engineer', company: 'Acme', applyUrl: 'https://acme.test/apply', descriptionHtml: '<p>Build.</p>' }

function setup(credits = 5) {
  const fake = createFakePrisma()
  fake.addUser('u1')
  const resumes: Record<string, any> = {}
  const kits: any[] = []
  const db: any = fake.prisma
  db.resume = {
    async findUnique({ where }: any) {
      return resumes[where.userId] ?? null
    },
  }
  db.applicationKit = {
    async findUnique({ where }: any) {
      const k = where.userId_jobId
      return kits.find((r) => r.userId === k.userId && r.jobId === k.jobId) ?? null
    },
    async upsert({ where, create, update }: any) {
      const k = where.userId_jobId
      const row = kits.find((r) => r.userId === k.userId && r.jobId === k.jobId)
      if (row) return Object.assign(row, update)
      const made = { id: `kit${kits.length + 1}`, status: 'saved', notes: null, createdAt: new Date(), ...create }
      kits.push(made)
      return made
    },
  }
  mockDb = db
  const grant = (n: number) =>
    db.$transaction((tx: any) =>
      grantCredits(tx, { userId: 'u1', credits: n, kind: 'pack', reason: 'pack:test', refId: 'pi_1', idempotencyKey: `g${n}${Math.random()}` }),
    )
  const ask = jest.fn(async () => reply)
  const deps = { findJob: async () => job, ask, cost: 0 }
  return { fake, resumes, kits, grant, ask, deps, credits }
}

const saveResume = (s: ReturnType<typeof setup>, text = 'resume text', stamp = 1000) => {
  s.resumes.u1 = { userId: 'u1', text, updatedAt: new Date(stamp) }
}

describe('generateKit', () => {
  it('needs a résumé first, and does not call the model without one', async () => {
    const s = setup()
    await s.grant(5)
    await expect(generateKit('u1', 'slug', s.deps)).rejects.toMatchObject({ code: 'no_resume', status: 400 })
    expect(s.ask).not.toHaveBeenCalled()
  })

  it('answers 404 for a job that does not exist', async () => {
    const s = setup()
    saveResume(s)
    await expect(generateKit('u1', 'x', { ...s.deps, findJob: async () => null })).rejects.toMatchObject({ code: 'job_not_found', status: 404 })
  })

  it('refuses before calling the model when the balance is too low', async () => {
    const s = setup()
    saveResume(s)
    await expect(generateKit('u1', 'slug', s.deps)).rejects.toMatchObject({ code: 'insufficient_credits', status: 402 })
    expect(s.ask).not.toHaveBeenCalled()
    expect(s.kits).toHaveLength(0)
  })

  it('charges once, saves the kit with the job copied in, and returns it', async () => {
    const s = setup()
    await s.grant(5)
    saveResume(s)
    const out = await generateKit('u1', 'engineer-j-abc', s.deps)
    expect(out.charged).toBe(1)
    expect(s.fake.balance('u1')).toBe(4)
    expect(out.kit).toMatchObject({ jobId: 'job1', jobSlug: 'engineer-j-abc', jobTitle: 'Engineer', companyName: 'Acme', bullets: ['Built X'] })
    expect(s.fake.tables.creditLedger.find((r) => r.kind === 'spend')).toMatchObject({ reason: 'application-kit', delta: -1 })
  })

  it('never charges when the model fails or answers badly', async () => {
    const s = setup()
    await s.grant(5)
    saveResume(s)
    s.ask.mockRejectedValueOnce(new Error('timeout'))
    await expect(generateKit('u1', 'slug', s.deps)).rejects.toMatchObject({ code: 'ai_unavailable', status: 502 })
    s.ask.mockResolvedValueOnce('I cannot do that')
    await expect(generateKit('u1', 'slug', s.deps)).rejects.toBeInstanceOf(KitError)
    expect(s.fake.balance('u1')).toBe(5)
    expect(s.kits).toHaveLength(0)
  })

  it('returns the saved kit for the same résumé without calling the model or charging again', async () => {
    const s = setup()
    await s.grant(5)
    saveResume(s)
    await generateKit('u1', 'slug', s.deps)
    const again = await generateKit('u1', 'slug', s.deps)
    expect(again.charged).toBe(0)
    expect(s.ask).toHaveBeenCalledTimes(1)
    expect(s.fake.balance('u1')).toBe(4)
  })

  it('makes a new, separately charged kit after the résumé changes, keeping tracker status and notes', async () => {
    const s = setup()
    await s.grant(5)
    saveResume(s, 'v1', 1000)
    await generateKit('u1', 'slug', s.deps)
    Object.assign(s.kits[0], { status: 'applied', notes: 'sent Monday' })
    saveResume(s, 'v2', 2000)
    const out = await generateKit('u1', 'slug', s.deps)
    expect(out.charged).toBe(1)
    expect(s.fake.balance('u1')).toBe(3)
    expect(s.kits).toHaveLength(1)
    expect(out.kit).toMatchObject({ status: 'applied', notes: 'sent Monday' })
  })

  it('charges once when the same request arrives twice at the same time', async () => {
    const s = setup()
    await s.grant(5)
    saveResume(s)
    const results = await Promise.allSettled([generateKit('u1', 'slug', s.deps), generateKit('u1', 'slug', s.deps)])
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    expect(s.fake.balance('u1')).toBe(4)
  })

  it('uses the configured price', async () => {
    const s = setup()
    await s.grant(5)
    saveResume(s)
    const out = await generateKit('u1', 'slug', { ...s.deps, cost: 3 })
    expect(out.charged).toBe(3)
    expect(s.fake.balance('u1')).toBe(2)
  })
})
