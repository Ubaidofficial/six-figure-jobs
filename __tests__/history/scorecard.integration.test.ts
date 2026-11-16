// Real Postgres, as the other history integration tests: skipped unless HISTORY_TEST_DATABASE_URL is set, and refuses a database
// whose name does not contain "test".
import { PrismaClient } from '@prisma/client'

import { collectScorecard } from '../../lib/history/scorecard'

const url = process.env.HISTORY_TEST_DATABASE_URL
const suite = url ? describe : describe.skip

suite('collectScorecard (real Postgres)', () => {
  let db: PrismaClient
  const DAY = 86_400_000
  const ago = (days: number) => new Date(Date.now() - days * DAY)

  beforeAll(async () => {
    if (!/test/i.test(new URL(url as string).pathname)) throw new Error('Refusing: the database name must contain "test".')
    db = new PrismaClient({ datasourceUrl: url })
    await db.$executeRawUnsafe('TRUNCATE "Job", "Company", "Feedback", "ApplyClick", "JobEvidence", "JobLifecycle", "MarketSnapshot", "ApplyClickWeekly" CASCADE')
  })
  afterAll(async () => {
    await db?.$disconnect()
  })

  const job = (id: string, over: Record<string, unknown> = {}) =>
    db.job.create({ data: { id, title: id, company: 'Acme', source: 'ats:test', isExpired: false, salaryValidated: true, ...over } })

  it('counts fields the way the scorecard describes them', async () => {
    await job('j1', { remote: true, countryCode: 'US', benefitsJson: '["unlimited_pto"]', techStack: '["react"]', postedAt: ago(1), visaSponsorship: true })
    await job('j2', { remoteMode: 'remote', countryCode: null, benefitsJson: '[]', postedAt: ago(40), lastSeenAt: ago(1) }) // remote, no country; empty benefits; old but seen
    await job('j3', { postedAt: null, createdAt: ago(30), salaryValidated: false, aiOneLiner: 'x'.repeat(30), expiresAt: ago(-5) })
    await job('j4', { isExpired: true, benefitsJson: '["x"]' }) // expired: no part of the live counts

    await db.company.create({ data: { name: 'A', slug: 'a', website: 'https://a.example', logoUrl: '', foundedYear: 2010 } })
    await db.company.create({ data: { name: 'B', slug: 'b' } })

    await db.feedback.create({ data: { type: 'wrong-salary', message: 'm' } })
    await db.feedback.create({ data: { type: 'wrong-salary', message: 'm', createdAt: ago(20) } })
    await db.feedback.create({ data: { type: 'bug', message: 'not a job report' } })
    await db.applyClick.create({ data: { jobId: 'j1', surface: 'hero', device: 'mobile' } })
    await db.applyClick.create({ data: { jobId: 'j1', surface: 'hero', device: 'mobile' } })
    await db.applyClick.create({ data: { jobId: 'j2', surface: 'hero', device: 'desktop', createdAt: ago(20) } })
    await db.jobEvidence.create({ data: { jobId: 'j1', field: 'benefits', value: 'unlimited_pto', quote: 'q', extractor: 'benefitsEvidence', extractorVersion: 1 } })

    const m = await collectScorecard(db)
    expect(m.jobs).toMatchObject({
      live: 3, salaryValidated: 2, withPostedAt: 2, remote: 2, remoteWithCountry: 1, withBenefits: 1, withTechStack: 1, withAiOneLiner: 1,
      withExpiresAt: 1, visaFlagged: 1,
    })
    expect(m.jobs.keptAliveOld).toBe(1) // j2
    expect(m.jobs.hiddenByAge).toBeGreaterThanOrEqual(2) // j2 (posted 40 days ago) and j3 (stored 30 days ago), whatever the age limit
    expect(m.companies).toMatchObject({ total: 2, website: 1, logo: 0, foundedYear: 1, industry: 0 }) // '' is not a logo
    expect(m.reports).toMatchObject({ last7d: 1, last30d: 2, 'wrong-salary.last7d': 1, 'wrong-salary.last30d': 2 })
    expect(m.clicks).toEqual({ last7d: 2, last30d: 3, distinctJobs30d: 2 })
    expect(m.evidence).toEqual({ rows: 1, benefits: 1 })
    expect(m.history).toMatchObject({ lifecycleTracked: 0, marketSnapshotRows: 0 })
    expect(m.latest).toEqual({ marketSnapshot: null, clickRollup: null })
  })
})
