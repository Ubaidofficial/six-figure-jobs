import { COMPANY_SIZE_BUCKETS, loadLevelSizeCounts } from '../../lib/jobs/levelSizeFacets'
import { loadWorkTypeAndRegionCounts, regionCountsFromRows, workTypesFromRows, type ModeRow, type NoCountryRow } from '../../lib/jobs/listingFacets'
import { LISTING_REMOTE_REGIONS } from '../../lib/jobs/remoteRegions'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: { job: { count: jest.fn(), groupBy: jest.fn() }, company: { findMany: jest.fn() } },
}))

const job = prisma.job as unknown as { count: jest.Mock; groupBy: jest.Mock }
const company = prisma.company as unknown as { findMany: jest.Mock }

const row = (over: Partial<ModeRow>): ModeRow => ({ remoteMode: 'remote', remote: true, countryCode: null, remoteRegion: null, count: 1, ...over })
const text = (locationRaw: string | null, count = 1, remoteRegion: string | null = null): NoCountryRow => ({ remoteRegion, locationRaw, count })
const regions = (slugs: string[], rows: ModeRow[], noCountry: NoCountryRow[]) => regionCountsFromRows(slugs.map((slug) => ({ slug })), rows, noCountry)

describe('workTypesFromRows', () => {
  it('adds up each work type and ignores jobs with none', () => {
    expect(workTypesFromRows([row({ remoteMode: 'remote', count: 3 }), row({ remoteMode: 'remote', countryCode: 'US', count: 2 }), row({ remoteMode: 'hybrid', count: 4 }), row({ remoteMode: 'onsite', count: 5 }), row({ remoteMode: null, count: 9 })])).toEqual({
      remote: 5,
      hybrid: 4,
      onsite: 5,
    })
  })
})

// The rules are those of remoteRegionWhere (lib/jobs/remoteRegions.ts); on a local database with synthetic jobs the grouped
// counts matched the separate counts for 8 listing bases (see the changelog).
describe('regionCountsFromRows', () => {
  it('counts a remote job whose country is in the region, and not a job that is not remote', () => {
    const rows = [row({ countryCode: 'DE', count: 4 }), row({ countryCode: 'DE', remoteMode: 'hybrid', remote: false, count: 7 }), row({ countryCode: 'US', count: 2 })]
    expect(regions(['europe', 'us-only', 'canada'], rows, [])).toEqual([4, 2, 0])
  })

  it('counts a remote flag with another work type as remote (the clause is remote OR remoteMode = remote)', () => {
    expect(regions(['us-only'], [row({ countryCode: 'US', remoteMode: 'onsite', remote: true, count: 3 })], [])).toEqual([3])
  })

  it('counts a stored region whatever its case, once, even when the text names it too', () => {
    const rows = [row({ remoteRegion: 'Europe', count: 2 }), row({ remoteRegion: 'EUROPE', count: 1 })]
    const noCountry = [text('Europe', 2, 'Europe'), text('Europe', 1, 'EUROPE'), text('Remote Europe', 5)]
    expect(regions(['europe'], rows, noCountry)).toEqual([3 + 5])
  })

  it('reads a region from the text of a job with no country, unless the text leaves it out', () => {
    // "(not UK)" is not left out: the rule looks for " not " with spaces, in the database clause and here alike.
    const noCountry = [text('North America', 2), text('Americas', 1), text('Remote excluding Europe', 4), text('Europe, not UK', 8), text('Europe (not UK)', 6), text('Berlin, Europe', 3)]
    expect(regions(['europe'], [], noCountry)).toEqual([6 + 3])
  })

  it('counts "anywhere in the world" only for text that says so and names nothing that limits it', () => {
    const noCountry = [
      text('Worldwide', 2),
      text('Anywhere', 1),
      text('Global', 1),
      text('Global (EMEA)', 5),
      text('Remote, anywhere, EST', 7),
      text('anywhere in the US', 3),
      text('us, remote', 4),
      text(null, 9),
      text('', 9),
    ]
    expect(regions(['global'], [row({ countryCode: 'US', count: 50 })], noCountry)).toEqual([4])
  })

  it('knows no region it is not given a definition for', () => {
    expect(regions(['nowhere'], [row({ countryCode: 'US' })], [text('Worldwide')])).toEqual([0])
  })
})

describe('loadWorkTypeAndRegionCounts', () => {
  beforeEach(() => {
    job.count.mockReset().mockResolvedValue(1)
    job.groupBy.mockReset()
  })

  it('uses two grouped queries and no count when no work type or region is chosen', async () => {
    job.groupBy
      .mockResolvedValueOnce([{ remoteMode: 'remote', remote: true, countryCode: 'US', remoteRegion: null, _count: { _all: 5 } }, { remoteMode: 'hybrid', remote: false, countryCode: 'DE', remoteRegion: null, _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ remoteRegion: null, locationRaw: 'Worldwide', _count: { _all: 3 } }])
    const out = await loadWorkTypeAndRegionCounts({ roleSlugs: ['software-engineer'], page: 1, pageSize: 1 }, LISTING_REMOTE_REGIONS)
    expect(job.count).not.toHaveBeenCalled()
    expect(job.groupBy).toHaveBeenCalledTimes(2)
    expect(out.workTypes).toEqual({ remote: 5, hybrid: 2, onsite: 0 })
    expect(out.regions[LISTING_REMOTE_REGIONS.findIndex((r) => r.slug === 'global')]).toBe(3)
    expect(out.regions[LISTING_REMOTE_REGIONS.findIndex((r) => r.slug === 'us-only')]).toBe(5)
  })

  it('asks for one grouped query only when there are no regions (the country pages)', async () => {
    job.groupBy.mockResolvedValueOnce([{ remoteMode: 'onsite', remote: false, countryCode: 'US', remoteRegion: null, _count: { _all: 8 } }])
    const out = await loadWorkTypeAndRegionCounts({ page: 1, pageSize: 1 }, [])
    expect(job.groupBy).toHaveBeenCalledTimes(1)
    expect(out).toEqual({ workTypes: { remote: 0, hybrid: 0, onsite: 8 }, regions: [] })
  })

  it.each([
    ['a work type', { remoteMode: 'remote' as const }],
    ['a region', { remoteRegion: 'europe' }],
  ])('runs the separate counts as before when %s is chosen (the counts keep the other filter)', async (_label, filter) => {
    const out = await loadWorkTypeAndRegionCounts({ page: 1, pageSize: 1, ...filter }, LISTING_REMOTE_REGIONS)
    expect(job.groupBy).not.toHaveBeenCalled()
    expect(job.count).toHaveBeenCalledTimes(3 + LISTING_REMOTE_REGIONS.length)
    expect(out.workTypes).toEqual({ remote: 1, hybrid: 1, onsite: 1 })
    expect(out.regions).toHaveLength(LISTING_REMOTE_REGIONS.length)
  })
})

describe('loadLevelSizeCounts: company sizes', () => {
  beforeEach(() => {
    job.count.mockReset().mockResolvedValue(0)
    job.groupBy.mockReset()
    company.findMany.mockReset()
  })

  it('reads the sizes from one grouped query and the companies, not five counts', async () => {
    job.groupBy
      .mockResolvedValueOnce([{ experienceLevel: 'senior', _count: { _all: 4 } }]) // seniority
      .mockResolvedValueOnce([
        { companyId: 'a', _count: { _all: 5 } },
        { companyId: 'b', _count: { _all: 2 } },
        { companyId: 'c', _count: { _all: 7 } },
        { companyId: 'd', _count: { _all: 1 } },
      ])
    company.findMany.mockResolvedValueOnce([
      { id: 'a', sizeBucket: '1-10' },
      { id: 'b', sizeBucket: '1-10' },
      { id: 'c', sizeBucket: '1000+' },
    ])
    const out = await loadLevelSizeCounts({ page: 1, pageSize: 1 })
    expect(job.count).not.toHaveBeenCalled()
    expect(out.companySizes).toEqual({ '1-10': 7, '11-50': 0, '51-200': 0, '201-1000': 0, '1000+': 7 })
    expect(out.seniority).toEqual({ senior: 4 })
    expect(company.findMany.mock.calls[0][0].where.id.in).toEqual(['a', 'b', 'c', 'd'])
  })

  it('does not look up companies when there are no jobs', async () => {
    job.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const out = await loadLevelSizeCounts({ page: 1, pageSize: 1 })
    expect(company.findMany).not.toHaveBeenCalled()
    expect(Object.keys(out.companySizes)).toEqual([...COMPANY_SIZE_BUCKETS])
  })

  it('counts each size separately when there are too many employers to group', async () => {
    job.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce(Array.from({ length: 5001 }, (_, i) => ({ companyId: `c${i}`, _count: { _all: 1 } })))
    job.count.mockResolvedValue(3)
    const out = await loadLevelSizeCounts({ page: 1, pageSize: 1 })
    expect(job.count).toHaveBeenCalledTimes(COMPANY_SIZE_BUCKETS.length)
    expect(company.findMany).not.toHaveBeenCalled()
    expect(out.companySizes['1-10']).toBe(3)
  })
})
