import { __clearMemoForTests } from '../../lib/cache/memo'
import { LISTING_REMOTE_REGIONS } from '../../lib/jobs/remoteRegions'
import { facetsForRole, isPlainRoleInput, loadRoleFacets, roleMatches, type RoleCube } from '../../lib/jobs/roleFacetCube'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({ prisma: { job: { groupBy: jest.fn() }, company: { findMany: jest.fn() } } }))

const groupBy = prisma.job.groupBy as unknown as jest.Mock
const companies = prisma.company.findMany as unknown as jest.Mock

const empty = (): RoleCube => ({ modeRows: [], noCountryRows: [], levelRows: [], companyRows: [], payRows: [], cityRows: [], sizeOf: new Map() })
const mode = (roleSlug: string | null, count: number, over: Record<string, unknown> = {}) => ({ roleSlug, remoteMode: 'onsite', remote: false, countryCode: null, remoteRegion: null, count, ...over })
const regions = LISTING_REMOTE_REGIONS

describe('roleMatches', () => {
  it('is the role page filter: the slug itself or a role that contains it', () => {
    expect(roleMatches('software-engineer', 'software-engineer')).toBe(true)
    expect(roleMatches('senior-software-engineer', 'software-engineer')).toBe(true)
    expect(roleMatches('data-engineer', 'software-engineer')).toBe(false)
    expect(roleMatches(null, 'software-engineer')).toBe(false)
  })
})

describe('isPlainRoleInput', () => {
  const plain = { page: 1, pageSize: 24, roleSlugs: ['x'], sortBy: 'date' as const }
  it('is true with no filter chosen', () => expect(isPlainRoleInput(plain)).toBe(true))
  it.each([
    ['a country', { countryCode: 'US' }],
    ['a work type', { remoteMode: 'remote' as const }],
    ['a region', { remoteRegion: 'europe' }],
    ['a seniority', { seniorityLevels: ['senior'] }],
    ['a company size', { companySizeBuckets: ['1-10'] }],
    ['a skill', { skillSlugs: ['python'] }],
    ['a minimum salary', { minAnnual: 150000, currency: 'USD' }],
  ])('is false with %s chosen', (_label, extra) => expect(isPlainRoleInput({ ...plain, ...extra })).toBe(false))
})

describe('facetsForRole', () => {
  it('adds up every row of every role the slug is part of, and no other', () => {
    const cube = empty()
    cube.modeRows = [mode('software-engineer', 5), mode('senior-software-engineer', 3), mode('data-engineer', 100), mode(null, 50)]
    expect(facetsForRole(cube, 'software-engineer', regions).total).toBe(8)
    expect(facetsForRole(cube, 'engineer', regions).total).toBe(108)
    expect(facetsForRole(cube, 'zz', regions).total).toBe(0)
  })

  it('lists the 40 biggest countries, biggest first', () => {
    const cube = empty()
    cube.modeRows = Array.from({ length: 45 }, (_, i) => mode('r', i + 1, { countryCode: `C${String(i).padStart(2, '0')}` }))
    const rows = facetsForRole(cube, 'r', regions).countryRows
    expect(rows).toHaveLength(40)
    expect(rows[0]).toEqual({ countryCode: 'C44', _count: { _all: 45 } })
    expect(rows[39]._count._all).toBe(6)
  })

  it('reads work types and regions from the rows (the rules are tested in listingFacets.test.ts)', () => {
    const cube = empty()
    cube.modeRows = [mode('r', 4, { remoteMode: 'remote', remote: true, countryCode: 'DE' }), mode('r', 2, { remoteMode: 'hybrid' })]
    const out = facetsForRole(cube, 'r', regions)
    expect(out.workTypes).toEqual({ remote: 4, hybrid: 2, onsite: 0 })
    expect(out.regions[regions.findIndex((r) => r.slug === 'europe')]).toBe(4)
  })

  it('counts seniority and company sizes, and picks the 24 biggest employers', () => {
    const cube = empty()
    cube.levelRows = [{ roleSlug: 'r', experienceLevel: 'senior', count: 3 }, { roleSlug: 'rr', experienceLevel: 'senior', count: 2 }, { roleSlug: 'x', experienceLevel: 'staff', count: 9 }]
    cube.companyRows = Array.from({ length: 30 }, (_, i) => ({ roleSlug: 'r', companyId: `c${i}`, count: i + 1 }))
    cube.sizeOf = new Map([['c29', '1-10'], ['c28', '1-10'], ['c0', '1000+']])
    const out = facetsForRole(cube, 'r', regions)
    expect(out.seniority).toEqual({ senior: 5 })
    expect(out.companySizes).toEqual({ '1-10': 30 + 29, '11-50': 0, '51-200': 0, '201-1000': 0, '1000+': 1 })
    expect(out.topCompanyGroups).toHaveLength(24)
    expect(out.topCompanyGroups[0]).toEqual({ companyId: 'c29', _count: { _all: 30 } })
  })

  it('averages pay only over the jobs that state it (a missing half is not a zero)', () => {
    const cube = empty()
    cube.payRows = [
      { roleSlug: 'role-a', sumMax: 400, nMax: 2, sumMin: 100, nMin: 1 },
      { roleSlug: 'role-a2', sumMax: 200, nMax: 1, sumMin: 0, nMin: 0 },
      { roleSlug: 'role-b', sumMax: 9999, nMax: 9, sumMin: 9999, nMin: 9 },
    ]
    expect(facetsForRole(cube, 'role-a', regions).avgUsd).toEqual({ _avg: { maxAnnual: 200, minAnnual: 100 } })
    expect(facetsForRole(cube, 'nothing', regions).avgUsd).toEqual({ _avg: { maxAnnual: null, minAnnual: null } })
  })

  it('ranks cities by average pay, highest first and a city with no figure first (as ORDER BY ... DESC does), six at most', () => {
    const cube = empty()
    const city = (citySlug: string, count: number, sumMax: number, nMax: number, sumMin: number, nMin: number, countryCode = 'US') => ({ roleSlug: 'r', citySlug, city: citySlug, countryCode, count, sumMax, nMax, sumMin, nMin })
    cube.cityRows = [
      city('a', 2, 600, 2, 400, 2), // 300k / 200k
      city('b', 1, 250, 1, 100, 1), // 250k / 100k
      city('c', 1, 0, 0, 0, 0), // no figure
      city('d', 1, 250, 1, 150, 1), // 250k / 150k: above b
      city('e', 1, 100, 1, 50, 1),
      city('f', 1, 90, 1, 40, 1),
      city('g', 1, 80, 1, 30, 1),
      city('a', 1, 300, 1, 200, 1, 'GB'), // same slug, another country: its own row, and the same pay as a/US (a tie: ordered by key)
    ]
    const out = facetsForRole(cube, 'r', regions).topCityRows
    expect(out.map((c) => `${c.citySlug}/${c.countryCode}`)).toEqual(['c/US', 'a/GB', 'a/US', 'd/US', 'b/US', 'e/US'])
    expect(out[2]).toEqual({ citySlug: 'a', city: 'a', countryCode: 'US', _count: { _all: 2 }, _avg: { maxAnnual: 300, minAnnual: 200 } })
  })
})

describe('loadRoleFacets', () => {
  beforeEach(() => {
    __clearMemoForTests()
    groupBy.mockReset()
    companies.mockReset()
  })

  it('builds the cube once with six grouped queries and serves every role from it', async () => {
    groupBy.mockImplementation(async (args: { by: string[] }) => {
      const by = args.by.join(',')
      if (by.startsWith('roleSlug,remoteMode')) return [{ roleSlug: 'software-engineer', remoteMode: 'remote', remote: true, countryCode: 'US', remoteRegion: null, _count: { _all: 7 } }, { roleSlug: 'data-engineer', remoteMode: 'onsite', remote: false, countryCode: 'US', remoteRegion: null, _count: { _all: 3 } }]
      return []
    })
    companies.mockResolvedValue([])
    const a = await loadRoleFacets('software-engineer')
    const b = await loadRoleFacets('data-engineer')
    expect(a?.total).toBe(7)
    expect(b?.total).toBe(3)
    expect(groupBy).toHaveBeenCalledTimes(6)
    expect(companies).toHaveBeenCalledTimes(1)
  })

  it('returns null, without keeping the failure, when the cube cannot be built (the page then runs its own queries)', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    groupBy.mockRejectedValue(new Error('database down'))
    companies.mockResolvedValue([])
    expect(await loadRoleFacets('software-engineer')).toBeNull()
    groupBy.mockReset().mockResolvedValue([])
    expect(await loadRoleFacets('software-engineer')).not.toBeNull()
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})
