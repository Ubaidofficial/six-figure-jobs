// Real Postgres, as the other history integration tests: skipped unless HISTORY_TEST_DATABASE_URL is set, and refuses a database
// whose name does not contain "test".
import { PrismaClient } from '@prisma/client'

import { rollupApplyClicks } from '../../lib/history/clickRollup'

const url = process.env.HISTORY_TEST_DATABASE_URL
const suite = url ? describe : describe.skip

suite('rollupApplyClicks (real Postgres)', () => {
  let db: PrismaClient
  const DAY = 86_400_000
  const ago = (days: number) => new Date(Date.now() - days * DAY)

  beforeAll(async () => {
    if (!/test/i.test(new URL(url as string).pathname)) throw new Error('Refusing: the database name must contain "test".')
    db = new PrismaClient({ datasourceUrl: url })
    await db.$executeRawUnsafe('TRUNCATE "Job", "ApplyClick", "ApplyClickWeekly" CASCADE')
    const job = (id: string, company: string, roleSlug: string, countryCode: string, source: string) =>
      db.job.create({ data: { id, title: id, company, roleSlug, countryCode, source } })
    await job('j1', 'Acme', 'engineer', 'US', 'ats:a')
    await job('j2', 'Beta', 'designer', 'DE', 'ats:b')
    const click = (jobId: string, createdAt: Date, device = 'desktop') => db.applyClick.create({ data: { jobId, surface: 'hero', device, createdAt } })
    // Seven days ago is always inside LAST week (Monday to Sunday), fourteen days ago inside the week before, today in the current one.
    await click('j1', ago(7), 'mobile')
    await click('j1', ago(7), 'mobile')
    await click('j1', ago(7))
    await click('j2', ago(7))
    await click('ghost', ago(7)) // the job no longer exists: still a click
    await click('j1', ago(14))
    await click('j1', ago(14))
    await click('j1', new Date()) // the current week is not finished: never rolled up
  })
  afterAll(async () => {
    await db?.$disconnect()
  })

  const weekly = (weekStartAgo: number, dimension: string, key = '') =>
    db.$queryRawUnsafe<Array<{ clicks: number; jobs: number; mobile: number }>>(
      `SELECT clicks, jobs, mobile FROM "ApplyClickWeekly" WHERE dimension = '${dimension}' AND key = '${key}' AND "weekStart" = (date_trunc('week', now() AT TIME ZONE 'UTC'))::date - ${weekStartAgo * 7}`,
    ).then((r) => r[0])

  it('a dry run counts rows and writes nothing', async () => {
    const r = await rollupApplyClicks(db, { apply: false, weeks: 2 })
    expect(r.map((w) => w.clicks)).toEqual([5, 2])
    expect(r[0].rows).toBeGreaterThan(0)
    expect(await db.applyClickWeekly.count()).toBe(0)
  })

  it('rolls up completed weeks by dimension, counting clicks on missing jobs and leaving the current week out', async () => {
    await rollupApplyClicks(db, { apply: true, weeks: 2 })
    expect(await weekly(1, 'all')).toEqual({ clicks: 5, jobs: 3, mobile: 2 })
    expect(await weekly(1, 'company', 'Acme')).toEqual({ clicks: 3, jobs: 1, mobile: 2 })
    expect(await weekly(1, 'company', 'Beta')).toEqual({ clicks: 1, jobs: 1, mobile: 0 })
    expect(await weekly(1, 'company', '(unknown)')).toEqual({ clicks: 1, jobs: 1, mobile: 0 }) // the click on the missing job
    expect(await weekly(1, 'role', 'engineer')).toMatchObject({ clicks: 3 })
    expect(await weekly(1, 'country', 'DE')).toMatchObject({ clicks: 1 })
    expect(await weekly(1, 'source', 'ats:a')).toMatchObject({ clicks: 3 })
    expect(await weekly(2, 'all')).toMatchObject({ clicks: 2 })
    expect(await weekly(0, 'all')).toBeUndefined() // this week: not rolled up
  })

  it('replaces a week on a re-run, so repeating it never double counts', async () => {
    const rows = await db.applyClickWeekly.count()
    await rollupApplyClicks(db, { apply: true, weeks: 2 })
    expect(await db.applyClickWeekly.count()).toBe(rows)
    await db.applyClick.create({ data: { jobId: 'j2', surface: 'hero', device: 'mobile', createdAt: ago(7) } })
    await rollupApplyClicks(db, { apply: true, weeks: 1 })
    expect(await weekly(1, 'all')).toEqual({ clicks: 6, jobs: 3, mobile: 3 })
    expect(await weekly(2, 'all')).toMatchObject({ clicks: 2 }) // the older week was not asked for again
  })
})
