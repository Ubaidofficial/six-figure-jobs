const jobGroupBy = jest.fn()
const companyGroupBy = jest.fn()

jest.mock('../../lib/prisma', () => ({
  prisma: { job: { groupBy: (args: any) => jobGroupBy(args) }, company: { groupBy: (args: any) => companyGroupBy(args) } },
}))

import { loadHubExtraFacets } from '../../lib/jobs/hubFacets'

const rows = (by: string[]) =>
  ({
    experienceLevel: [
      { experienceLevel: 'lead', _count: { _all: 4 } },
      { experienceLevel: 'senior', _count: { _all: 10 } },
      { experienceLevel: 'mid', _count: { _all: 99 } }, // not a level the site offers
    ],
    'citySlug,city': [
      { citySlug: 'zurich', city: 'Zurich', _count: { _all: 2 } },
      { citySlug: 'zurich', city: 'Zürich', _count: { _all: 5 } },
      { citySlug: 'zug', city: 'Zug', _count: { _all: 4 } },
    ],
    countryCode: [
      { countryCode: 'US', _count: { _all: 7 } },
      { countryCode: 'DE', _count: { _all: 3 } },
      { countryCode: null, _count: { _all: 2 } },
    ],
  })[by.join(',')] ?? []

beforeEach(() => {
  jobGroupBy.mockReset()
  companyGroupBy.mockReset()
  jobGroupBy.mockImplementation(async (args: any) => rows(args.by))
  companyGroupBy.mockResolvedValue([
    { sizeBucket: '201-1000', _count: { _all: 3 } },
    { sizeBucket: '11-50', _count: { _all: 1 } },
    { sizeBucket: '1000+', _count: { _all: 8 } }, // not a bucket the enricher writes
  ])
})

describe('loadHubExtraFacets', () => {
  it('lists only seniority levels the site offers, in seniority order, with counts', async () => {
    const f = await loadHubExtraFacets({})
    expect(f.seniorities).toEqual([
      { value: 'senior', count: 10 },
      { value: 'lead', count: 4 },
    ])
  })

  it('merges spellings of one city slug and sorts the biggest first', async () => {
    const f = await loadHubExtraFacets({})
    expect(f.cities).toEqual([
      { value: 'zurich', label: 'Zürich', count: 7 },
      { value: 'zug', label: 'Zug', count: 4 },
    ])
  })

  it('counts remote jobs per region from their countries, and only shows regions that have some', async () => {
    const f = await loadHubExtraFacets({})
    expect(f.remoteRegions).toEqual([
      { value: 'global', count: 2 },
      { value: 'us-only', count: 7 },
      { value: 'europe', count: 3 },
    ])
  })

  it('offers company sizes in the enricher\'s buckets only', async () => {
    const f = await loadHubExtraFacets({})
    expect(f.companySizes).toEqual(['11-50', '201-1000'])
  })

  it('does not apply a facet\'s own filter to it, so the other choices stay visible', async () => {
    await loadHubExtraFacets({ seniorityLevels: ['senior'], citySlug: 'zug' })
    const where = (by: string) => JSON.stringify(jobGroupBy.mock.calls.find(([a]) => a.by.join(',') === by)![0].where, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
    expect(where('experienceLevel')).not.toContain('"in":["senior"]')
    expect(where('experienceLevel')).toContain('"citySlug":"zug"')
    expect(where('citySlug,city')).not.toContain('"citySlug":"zug"')
    expect(where('citySlug,city')).toContain('"in":["senior"]')
  })

  it('leaves a section out instead of failing the page when its query fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    jobGroupBy.mockImplementation(async (args: any) => {
      if (args.by[0] === 'citySlug') throw new Error('boom')
      return rows(args.by)
    })
    const f = await loadHubExtraFacets({})
    expect(f.cities).toEqual([])
    expect(f.seniorities).toHaveLength(2)
    spy.mockRestore()
  })
})
