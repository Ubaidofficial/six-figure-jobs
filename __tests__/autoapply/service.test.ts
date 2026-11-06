import fixture from './fixtures/greenhouse-anduril.json'
import { createFakePrisma } from '../billing/fakePrisma'

let mockDb: any
jest.mock('@/lib/prisma', () => ({ prisma: new Proxy({}, { get: (_t, k) => mockDb[k] }) }))

import {
  AutoApplyError, approveApplication, cancelApplication, cleanProfile, prepareApplication, recoverStuckApplications, runApplication, saveDraft,
  type ApplyDriver,
} from '@/lib/autoapply/service'
import { MAX_APPLICATIONS_PER_USER_PER_DAY, MAX_PER_BOARD_PER_HOUR } from '@/lib/autoapply/config'
import { grantCredits } from '@/lib/billing/credits'
import type { Plan } from '@/lib/autoapply/plan'

type Row = Record<string, any>
const matches = (row: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([k, c]) => {
    if (k === 'userId_jobId') return row.userId === (c as Row).userId && row.jobId === (c as Row).jobId
    if (c && typeof c === 'object' && !(c instanceof Date)) {
      if ('in' in c) return (c.in as unknown[]).includes(row[k])
      if ('gte' in c) return row[k] != null && row[k] >= c.gte
      if ('lt' in c) return row[k] != null && row[k] < c.lt
    }
    return row[k] === c
  })

function table(rows: Row[], key: string, defaults: () => Row = () => ({})) {
  let n = 0
  const pick = (where: Row) => rows.find((r) => matches(r, where)) ?? null
  return {
    rows,
    async findUnique({ where }: Row) { return pick(where) },
    async findFirst({ where }: Row) { return pick(where) },
    async findUniqueOrThrow({ where }: Row) { const r = pick(where); if (!r) throw new Error('not found'); return r },
    async count({ where }: Row) { return rows.filter((r) => matches(r, where)).length },
    async create({ data }: Row) { const r = { [key]: `${key}${++n}`, ...defaults(), ...data }; rows.push(r); return r },
    async update({ where, data }: Row) { const r = pick(where); if (!r) throw new Error('not found'); return Object.assign(r, data) },
    async updateMany({ where, data }: Row) { const hit = rows.filter((r) => matches(r, where)); hit.forEach((r) => Object.assign(r, data)); return { count: hit.length } },
    async upsert({ where, create, update }: Row) { const r = pick(where); return r ? Object.assign(r, update) : (rows.push({ ...create }), create) },
  }
}

const job = { id: 'job1', title: 'Software Engineer', company: 'Anduril', applyUrl: 'https://boards.greenhouse.io/andurilindustries/jobs/5278136007?gh_jid=5278136007', descriptionHtml: '' }
const ghJob = { title: fixture.title, questions: fixture.questions as never, eeoc: [], needsConsent: false }

function setup(credits = 20) {
  const fake = createFakePrisma()
  fake.addUser('u1', { email: 'ada@example.test' })
  fake.addUser('u2', { email: 'bob@example.test' })
  const db: any = fake.prisma
  db.resume = table([{ userId: 'u1', text: 'My résumé', updatedAt: new Date(1000) }], 'userId')
  db.applyProfile = table([], 'userId')
  db.applicationKit = table([{ userId: 'u1', jobId: 'job1', coverLetter: 'Dear team' }], 'id')
  db.autoApplication = table([], 'id', () => ({ status: 'draft', charge: 'none', createdAt: new Date(), planHash: null }))
  // user.findUnique in the fake returns the row incl. email
  mockDb = db
  const grant = (n: number) => db.$transaction((tx: any) => grantCredits(tx, { userId: 'u1', credits: n, kind: 'pack', reason: 'test', refId: 'pi', idempotencyKey: `g${Math.random()}` }))
  const deps = { findJob: async () => job as never, fetchJob: async () => ghJob }
  return { fake, db, grant, deps, credits }
}

const goodProfile = { firstName: 'Ada', lastName: 'Lovelace', phone: '+1 555 0100', linkedin: 'https://linkedin.com/in/ada' }

/** Fills every required question with the employer's first option, or short text, the way a user would in the review. */
async function readyDraft(s: ReturnType<typeof setup>) {
  const draft = await prepareApplication('u1', 'slug', s.deps)
  const plan = draft.plan as Plan
  const answers: Record<string, unknown> = {}
  for (const f of plan.fields) {
    if (f.source !== 'user' || !f.required) continue
    answers[f.key] = f.type === 'single' ? f.options![0].value : f.type === 'multi' ? [f.options![0].value] : 'answer'
  }
  const saved = await saveDraft('u1', draft.id, { profile: goodProfile, answers })
  return { id: draft.id, hash: saved.hash }
}

const submitted: ApplyDriver = async () => ({ kind: 'submitted', evidence: 'Thank you for applying' })
const balance = (s: ReturnType<typeof setup>) => s.fake.balance('u1')

describe('cleanProfile', () => {
  it('accepts a complete profile and https links, trimming text', () => {
    expect(cleanProfile({ ...goodProfile, firstName: '  Ada ' })).toMatchObject({ ok: true, profile: { firstName: 'Ada', github: null } })
  })
  it('names the fields that are wrong: missing required text, http or script links', () => {
    expect(cleanProfile({ firstName: '', lastName: 'L', phone: '1', linkedin: 'http://x.test', website: 'javascript:alert(1)' })).toEqual({
      ok: false, fields: expect.arrayContaining(['firstName', 'linkedin', 'website']),
    })
  })
})

describe('prepareApplication', () => {
  it('needs a résumé, a Greenhouse apply link and a form it can read', async () => {
    const s = setup()
    s.db.resume.rows.length = 0
    await expect(prepareApplication('u1', 'slug', s.deps)).rejects.toMatchObject({ code: 'no_resume' })
    s.db.resume.rows.push({ userId: 'u1', text: 'r', updatedAt: new Date(1) })
    await expect(prepareApplication('u1', 'slug', { ...s.deps, findJob: async () => ({ ...job, applyUrl: 'https://jobs.lever.co/a/1' }) as never })).rejects.toMatchObject({ code: 'unsupported_employer', status: 422 })
    await expect(prepareApplication('u1', 'slug', { ...s.deps, findJob: async () => null })).rejects.toMatchObject({ code: 'job_not_found' })
    await expect(prepareApplication('u1', 'slug', { ...s.deps, fetchJob: async () => null })).rejects.toMatchObject({ code: 'form_unavailable' })
  })

  it('writes a draft that costs nothing, fills the standard fields, and returns the same draft the second time', async () => {
    const s = setup()
    await s.grant(20)
    const a = await prepareApplication('u1', 'slug', s.deps)
    expect(a).toMatchObject({ status: 'draft', board: 'andurilindustries', ghJobId: '5278136007', jobTitle: 'Software Engineer' })
    const plan = a.plan as Plan
    expect(plan.fields.find((f) => f.key === 'email')!.value).toBe('ada@example.test')
    expect(plan.fields.find((f) => f.key === 'cover_letter_text')!.value).toBe('Dear team')
    expect(balance(s)).toBe(20)
    expect((await prepareApplication('u1', 'slug', s.deps)).id).toBe(a.id)
  })
})

describe('a second application for the same job', () => {
  it('is blocked while one is live, but not after one was cancelled', async () => {
    const s = setup()
    await s.grant(20)
    const first = await prepareApplication('u1', 'slug', s.deps)
    s.db.autoApplication.rows[0].status = 'approved'
    await expect(prepareApplication('u1', 'slug', s.deps)).rejects.toMatchObject({ code: 'already_exists', details: { id: first.id, status: 'approved' } })
    await cancelApplication('u1', first.id)
    const second = await prepareApplication('u1', 'slug', s.deps)
    expect(second.id).not.toBe(first.id)
    expect(second.status).toBe('draft')
  })
})

describe('saveDraft', () => {
  it('saves the profile into the form, refuses a bad profile, and shows what is still missing', async () => {
    const s = setup()
    const d = await prepareApplication('u1', 'slug', s.deps)
    const r = await saveDraft('u1', d.id, { profile: goodProfile })
    expect(r.missing.length).toBeGreaterThan(0) // the employer's own required questions
    expect((r.plan.fields.find((f) => f.key === 'first_name')!.value)).toBe('Ada')
    expect(s.db.applyProfile.rows).toHaveLength(1)
    await expect(saveDraft('u1', d.id, { profile: { ...goodProfile, linkedin: 'http://nope' } })).rejects.toMatchObject({ code: 'invalid', details: { fields: ['linkedin'] } })
  })

  it('reports an answer the employer does not offer, and only the owner can edit a draft', async () => {
    const s = setup()
    const d = await prepareApplication('u1', 'slug', s.deps)
    const auth = (d.plan as Plan).fields.find((f) => /U\.S\. WORK AUTHORIZATION/.test(f.label))!
    expect((await saveDraft('u1', d.id, { answers: { [auth.key]: 'maybe' } })).errors[auth.key]).toBe('invalid')
    await expect(saveDraft('u2', d.id, { answers: {} })).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('approveApplication', () => {
  it('refuses an incomplete draft, a stale hash and too few credits; approves the reviewed plan once', async () => {
    const s = setup()
    await s.grant(20)
    const d = await prepareApplication('u1', 'slug', s.deps)
    await expect(approveApplication('u1', d.id, 'x')).rejects.toMatchObject({ code: 'incomplete' })

    const { id, hash } = await readyDraft(s)
    await expect(approveApplication('u1', id, 'not-the-hash')).rejects.toMatchObject({ code: 'changed' })
    s.fake.tables.creditLedger.push({ userId: 'u1', delta: -18, kind: 'spend', reason: 'x', idempotencyKey: 'drain', id: 'd' })
    await expect(approveApplication('u1', id, hash)).rejects.toMatchObject({ code: 'insufficient_credits' })
    s.fake.tables.creditLedger.pop()

    const ok = await approveApplication('u1', id, hash)
    expect(ok).toMatchObject({ status: 'approved', planHash: hash })
    expect(balance(s)).toBe(20) // approval does not charge
    await expect(approveApplication('u1', id, hash)).rejects.toMatchObject({ code: 'not_editable' })
  })

  it('needs the employer\'s consent ticked when the board asks for it', async () => {
    const s = setup()
    await s.grant(20)
    const deps = { ...s.deps, fetchJob: async () => ({ ...ghJob, needsConsent: true }) }
    const draft = await prepareApplication('u1', 'slug', deps)
    const plan = draft.plan as Plan
    const answers = Object.fromEntries(plan.fields.filter((f) => f.source === 'user' && f.required).map((f) => [f.key, f.type === 'single' ? f.options![0].value : 'a']))
    const saved = await saveDraft('u1', draft.id, { profile: goodProfile, answers })
    await expect(approveApplication('u1', draft.id, saved.hash)).rejects.toMatchObject({ code: 'consent_required' })
    const again = await saveDraft('u1', draft.id, { consent: true })
    expect((await approveApplication('u1', draft.id, again.hash)).status).toBe('approved')
  })

  it('stops an account that already has the daily limit of applications', async () => {
    const s = setup()
    await s.grant(20)
    for (let i = 0; i < MAX_APPLICATIONS_PER_USER_PER_DAY; i++) s.db.autoApplication.rows.push({ id: `old${i}`, userId: 'u1', jobId: `o${i}`, status: 'submitted', createdAt: new Date(), board: 'b' })
    const { id, hash } = await readyDraft(s)
    await expect(approveApplication('u1', id, hash)).rejects.toMatchObject({ code: 'daily_limit', status: 429 })
  })

  it('lets the owner cancel a draft or an approved application, and nothing else', async () => {
    const s = setup()
    await s.grant(20)
    const { id, hash } = await readyDraft(s)
    await approveApplication('u1', id, hash)
    await expect(cancelApplication('u2', id)).rejects.toBeInstanceOf(AutoApplyError)
    await cancelApplication('u1', id)
    expect(s.db.autoApplication.rows[0].status).toBe('cancelled')
    await expect(cancelApplication('u1', id)).rejects.toMatchObject({ code: 'not_editable' })
  })
})

describe('runApplication: what is charged and when', () => {
  async function approved(credits = 20) {
    const s = setup()
    await s.grant(credits)
    const { id, hash } = await readyDraft(s)
    await approveApplication('u1', id, hash)
    return { s, id, row: () => s.db.autoApplication.rows.find((r: Row) => r.id === id) as Row }
  }

  it('a confirmed submission takes the credits once and keeps the employer\'s confirmation', async () => {
    const { s, id, row } = await approved()
    const driver = jest.fn(submitted)
    expect(await runApplication(id, driver, { live: true })).toEqual({ done: 'finished', status: 'submitted' })
    expect(row()).toMatchObject({ status: 'submitted', charge: 'charged', evidence: 'Thank you for applying' })
    expect(balance(s)).toBe(15) // 20 - 5 (placeholder price)
    expect(driver).toHaveBeenCalledWith(expect.objectContaining({ live: true, resumeText: 'My résumé', applyUrl: job.applyUrl }))
    expect(await runApplication(id, driver, { live: true })).toEqual({ done: 'skipped', why: 'not_approved' })
    expect(driver).toHaveBeenCalledTimes(1)
  })

  it.each(['captcha', 'security_code', 'login', 'unexpected_field', 'validation', 'unconfirmed'] as const)('%s stops with the user and charges nothing', async (reason) => {
    const { s, id, row } = await approved()
    const res = await runApplication(id, async () => ({ kind: 'needs_user', reason }), { live: true })
    expect(res).toEqual({ done: 'finished', status: 'needs_user', reason })
    expect(row()).toMatchObject({ status: 'needs_user', reason, charge: 'none' })
    expect(balance(s)).toBe(20)
  })

  it('a failure, or a driver that crashes, charges nothing', async () => {
    const a = await approved()
    await runApplication(a.id, async () => ({ kind: 'failed', reason: 'timeout' }), { live: true })
    expect(a.row()).toMatchObject({ status: 'failed', reason: 'timeout', charge: 'none' })
    const b = await approved()
    await runApplication(b.id, async () => { throw new Error('boom') }, { live: true })
    expect(b.row()).toMatchObject({ status: 'failed', reason: 'driver_error', charge: 'none' })
    expect(a.s.fake.balance('u1')).toBe(20)
    expect(b.s.fake.balance('u1')).toBe(20)
  })

  it('a dry run fills and reports but claims, sends and charges nothing', async () => {
    const { s, id, row } = await approved()
    const driver = jest.fn(async () => ({ kind: 'dry_run' as const, filled: ['first_name'], unfilled: [] }))
    expect(await runApplication(id, driver, { live: false })).toMatchObject({ done: 'dry_run' })
    expect(driver).toHaveBeenCalledWith(expect.objectContaining({ live: false }))
    expect(row()).toMatchObject({ status: 'approved', charge: 'none' })
    expect(balance(s)).toBe(20)
  })

  it('refuses to send anything that is not what was approved: a changed plan, or a changed résumé', async () => {
    const t = await approved()
    const driver = jest.fn(submitted)
    t.row().plan = { ...t.row().plan, fields: t.row().plan.fields.map((f: any) => (f.key === 'phone' ? { ...f, value: '+1 000' } : f)) }
    expect(await runApplication(t.id, driver, { live: true })).toMatchObject({ status: 'failed', reason: 'plan_changed' })

    const r = await approved()
    r.s.db.resume.rows[0].updatedAt = new Date(2000)
    expect(await runApplication(r.id, driver, { live: true })).toMatchObject({ status: 'needs_user', reason: 'resume_changed' })
    expect(driver).not.toHaveBeenCalled()
  })

  it('does not submit when the credits are gone by the time the worker runs', async () => {
    const { s, id, row } = await approved()
    s.fake.tables.creditLedger.push({ userId: 'u1', delta: -18, kind: 'spend', reason: 'x', idempotencyKey: 'drain', id: 'd' })
    const driver = jest.fn(submitted)
    expect(await runApplication(id, driver, { live: true })).toMatchObject({ status: 'failed', reason: 'insufficient_credits' })
    expect(driver).not.toHaveBeenCalled()
    expect(row().status).toBe('failed')
  })

  it('records "unpaid" (and still submitted) if the credits cannot be taken after a confirmed submission', async () => {
    const { s, id, row } = await approved()
    const driver: ApplyDriver = async () => {
      s.fake.tables.creditLedger.push({ userId: 'u1', delta: -18, kind: 'spend', reason: 'x', idempotencyKey: 'late', id: 'l' })
      return { kind: 'submitted', evidence: 'ok' }
    }
    await runApplication(id, driver, { live: true })
    expect(row()).toMatchObject({ status: 'submitted', charge: 'unpaid' })
  })

  it('two workers racing for one application send it once', async () => {
    const { id } = await approved()
    const driver = jest.fn(async () => { await new Promise((r) => setImmediate(r)); return { kind: 'submitted' as const, evidence: 'ok' } })
    const [a, b] = await Promise.all([runApplication(id, driver, { live: true }), runApplication(id, driver, { live: true })])
    expect(driver).toHaveBeenCalledTimes(1)
    expect([a.done, b.done].sort()).toEqual(['finished', 'skipped'])
  })

  it('waits when an employer\'s board already had its hourly limit of applications', async () => {
    const { s, id, row } = await approved()
    for (let i = 0; i < MAX_PER_BOARD_PER_HOUR; i++) s.db.autoApplication.rows.push({ id: `b${i}`, userId: 'u2', board: 'andurilindustries', status: 'submitted', startedAt: new Date(), createdAt: new Date() })
    const driver = jest.fn(submitted)
    expect(await runApplication(id, driver, { live: true })).toEqual({ done: 'skipped', why: 'board_busy' })
    expect(driver).not.toHaveBeenCalled()
    expect(row().status).toBe('approved') // still waiting, not failed
  })
})

describe('recoverStuckApplications', () => {
  it('turns an application stuck in "submitting" into "needs you / unconfirmed", never a retry and never a charge', async () => {
    const s = setup()
    await s.grant(20)
    const now = Date.now()
    s.db.autoApplication.rows.push(
      { id: 'stuck', userId: 'u1', status: 'submitting', startedAt: new Date(now - 20 * 60_000), charge: 'none' },
      { id: 'fresh', userId: 'u1', status: 'submitting', startedAt: new Date(now - 60_000), charge: 'none' },
      { id: 'done', userId: 'u1', status: 'submitted', startedAt: new Date(now - 3 * 3600_000), charge: 'charged' },
    )
    expect(await recoverStuckApplications(15 * 60_000, now)).toBe(1)
    const by = (id: string) => s.db.autoApplication.rows.find((r: Row) => r.id === id)
    expect(by('stuck')).toMatchObject({ status: 'needs_user', reason: 'unconfirmed', charge: 'none' })
    expect(by('fresh').status).toBe('submitting')
    expect(by('done').status).toBe('submitted')
    expect(balance(s)).toBe(20)
  })
})
