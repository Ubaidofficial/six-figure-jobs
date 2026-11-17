// Runs the region-by-location-text filter against a real Postgres, where NULL behaves as SQL says (a NULL location text inside a
// NOT(...) must not drop or add rows). Skipped unless REGION_TEST_DATABASE_URL is set (CI has no database); refuses any database
// whose name does not contain "test", because it empties the Job table.
//
//   REGION_TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/sfj_region_test npx jest __tests__/jobs/remoteRegionText.integration
import { PrismaClient } from '@prisma/client'

import { remoteRegionWhere } from '../../lib/jobs/remoteRegions'

const url = process.env.REGION_TEST_DATABASE_URL
const suite = url ? describe : describe.skip

suite('remote region filter, location text (real Postgres)', () => {
  let db: PrismaClient
  // id, remote flag, country, location text
  const seed: Array<[string, boolean, string | null, string | null]> = [
    ['na', true, null, 'North America'],
    ['americas', true, null, 'Americas Remote'],
    ['europe', true, null, 'Remote - Europe'],
    ['plain', true, null, 'Remote'],
    ['nulltext', true, null, null],
    ['excl-us', true, null, 'Americas excluding the US'],
    ['excl-eu', true, null, 'Worldwide except Europe'],
    ['de-with-na-text', true, 'DE', 'North America'],
    ['us-country', true, 'US', 'San Francisco'],
    ['onsite-europe-text', false, null, 'Europe'],
    ['latam', true, null, 'Latin America'],
  ]

  beforeAll(async () => {
    if (!/test/i.test(new URL(url as string).pathname)) throw new Error('Refusing: the database name must contain "test".')
    db = new PrismaClient({ datasourceUrl: url })
    await db.$executeRawUnsafe('TRUNCATE "Job" CASCADE')
    for (const [id, remote, countryCode, locationRaw] of seed) {
      await db.job.create({
        data: { id, title: 'Engineer', company: 'Acme', source: 'ats:test', minAnnual: 100000n, maxAnnual: 120000n, currency: 'USD', roleSlug: 'engineer', remote, remoteMode: remote ? 'remote' : 'onsite', countryCode, locationRaw },
      })
    }
  })
  afterAll(async () => {
    await db?.$disconnect()
  })

  const ids = async (slug: string) => (await db.job.findMany({ where: remoteRegionWhere(slug), select: { id: true } })).map((j) => j.id).sort()

  it('US and Canada list the North America and Americas jobs with no country, plus their own country', async () => {
    expect(await ids('us-only')).toEqual(['americas', 'na', 'us-country'])
    expect(await ids('canada')).toEqual(['americas', 'na'])
  })

  it('Europe and EMEA list the Europe job with no country and the German job by its country, and not a job that is not remote', async () => {
    expect(await ids('europe')).toEqual(['de-with-na-text', 'europe'])
    expect(await ids('emea')).toEqual(['de-with-na-text', 'europe'])
  })

  it('a stored country decides, text that leaves the place out does not count, and a missing text matches nothing', async () => {
    for (const slug of ['us-only', 'canada']) {
      const got = await ids(slug)
      for (const id of ['de-with-na-text', 'excl-us', 'excl-eu', 'nulltext', 'plain', 'latam', 'europe']) expect(got).not.toContain(id)
    }
    for (const slug of ['europe', 'emea']) {
      const got = await ids(slug)
      for (const id of ['excl-us', 'excl-eu', 'nulltext', 'plain', 'latam', 'na', 'onsite-europe-text']) expect(got).not.toContain(id)
    }
  })

  it('regions that read no text are unchanged', async () => {
    expect(await ids('australia')).toEqual([])
    expect(await ids('apac')).toEqual([])
  })
})
