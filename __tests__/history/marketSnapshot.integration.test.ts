// Real Postgres, as lifecycle.integration.test.ts: skipped unless HISTORY_TEST_DATABASE_URL is set, and refuses a database
// whose name does not contain "test".
import { PrismaClient } from '@prisma/client'

import { snapshotMarket } from '../../lib/history/marketSnapshot'

const url = process.env.HISTORY_TEST_DATABASE_URL
const suite = url ? describe : describe.skip

suite('snapshotMarket (real Postgres)', () => {
  let db: PrismaClient
  let n = 0

  beforeAll(async () => {
    if (!/test/i.test(new URL(url as string).pathname)) throw new Error('Refusing: the database name must contain "test".')
    db = new PrismaClient({ datasourceUrl: url })
    await db.$executeRawUnsafe('TRUNCATE "MarketSnapshot", "Job" CASCADE')
  })
  afterAll(async () => {
    await db?.$disconnect()
  })

  /** A validated six-figure job; min/max are annual figures, so the midpoint is the pay used. */
  const job = (over: Record<string, unknown> = {}) =>
    db.job.create({
      data: {
        id: `m${++n}`, title: 'Engineer', company: `Co ${n}`, source: 'ats:test', currency: 'USD', salaryValidated: true, salaryConfidence: 90,
        minAnnual: 100000n, maxAnnual: 100000n, roleSlug: 'engineer', countryCode: 'US', experienceLevel: 'senior', remoteMode: 'remote', isExpired: false, ...over,
      },
    })
  const snap = (dimension: string, key: string, currency = 'USD') =>
    db.marketSnapshot.findFirst({ where: { dimension, key, currency } })

  it('computes cells with the research method and leaves out what the method leaves out', async () => {
    for (const pay of [100000n, 200000n, 300000n]) await job({ minAnnual: pay, maxAnnual: pay }) // 3 in the cell: median 200k
    await job({ minAnnual: 150000n, maxAnnual: 250000n, roleSlug: 'designer' }) // a cell of one: below the minimum size
    await job({ maxAnnual: 600000n, minAnnual: 600000n }) // exactly the USD clamp: not a real figure
    await job({ isExpired: true, minAnnual: 900000n, maxAnnual: 900000n }) // expired
    await job({ salaryValidated: false, minAnnual: 900000n, maxAnnual: 900000n }) // pay not validated
    await job({ salaryConfidence: 50, minAnnual: 900000n, maxAnnual: 900000n }) // below the confidence gate
    await job({ company: 'Jooble Jobs', minAnnual: 900000n, maxAnnual: 900000n }) // an aggregator, not an employer
    await job({ experienceLevel: 'mid' }) // 'mid' is the default for "unknown": not a level

    const dry = await snapshotMarket(db, { apply: false })
    expect(dry.cells.role).toBe(1) // only 'engineer'
    expect(await db.marketSnapshot.count()).toBe(0)

    await snapshotMarket(db, { apply: true })
    // engineer jobs counted: 100k, 200k, 300k, plus the 'mid' one at 100k = 4 (the clamp, expired, unvalidated, low-confidence
    // and aggregator jobs are out)
    const role = await snap('role', 'engineer')
    expect(role).toMatchObject({ jobs: 4, companies: 4, p25: 100000, median: 150000, p75: 225000, methodVersion: '1.0' })
    expect(await snap('role', 'designer')).toBeNull() // one job: below SNAPSHOT_MIN_JOBS
    // Dimensions other than role also take the designer job (200k, senior, remote, US): 3 engineers + 1 designer are 'senior', and
    // all 5 counted jobs (the 'mid' engineer included: it still has pay) are remote and in the overall cell, median 200k.
    expect(await snap('level', 'senior')).toMatchObject({ jobs: 4, median: 200000 })
    expect(await snap('level', 'mid')).toBeNull()
    expect(await snap('arrangement', 'remote')).toMatchObject({ jobs: 5 })
    expect(await snap('role_country', 'engineer|US')).toMatchObject({ jobs: 4 })
    expect(await snap('all', '')).toMatchObject({ jobs: 5, median: 200000 })
  })

  it('keeps currencies apart and applies the clamp to USD only', async () => {
    for (const pay of [700000n, 800000n, 900000n]) await job({ currency: 'EUR', roleSlug: 'analyst', countryCode: 'DE', minAnnual: pay, maxAnnual: pay })
    await snapshotMarket(db, { apply: true })
    expect(await snap('role', 'analyst', 'EUR')).toMatchObject({ jobs: 3, median: 800000 }) // above 600k is fine outside USD
    expect(await snap('role', 'analyst', 'USD')).toBeNull()
  })

  it('replaces the same date on a re-run instead of duplicating, and records new jobs of the last 7 days', async () => {
    const before = await db.marketSnapshot.count()
    await snapshotMarket(db, { apply: true })
    expect(await db.marketSnapshot.count()).toBe(before)
    expect((await snap('role', 'engineer'))?.newJobs7d).toBe(4) // all created just now
  })
})
