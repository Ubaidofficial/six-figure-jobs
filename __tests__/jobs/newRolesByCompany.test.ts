const mockGroupBy = jest.fn()
const mockFindMany = jest.fn()
jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: { groupBy: (...a: unknown[]) => mockGroupBy(...a) },
    company: { findMany: (...a: unknown[]) => mockFindMany(...a) },
  },
}))

import { __clearMemoForTests } from '@/lib/cache/memo'
import { NEW_ROLES_LIMIT, loadNewRolesByCompany, shapeNewRolesCompanies } from '@/lib/jobs/newRolesByCompany'

const company = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `Company ${id}`,
  slug: `company-${id}`,
  logoUrl: null,
  website: null,
  ...over,
})
const group = (companyId: string | null, count: number) => ({ companyId, _count: { _all: count } })

beforeEach(() => {
  __clearMemoForTests()
  mockGroupBy.mockReset()
  mockFindMany.mockReset()
})

describe('shapeNewRolesCompanies', () => {
  it('lists the busiest companies first, ties by name', () => {
    const out = shapeNewRolesCompanies(
      [group('b', 3), group('a', 3), group('c', 9)],
      [company('a'), company('b'), company('c')],
      new Set(['a', 'b', 'c']),
    )
    expect(out.map((c) => [c.id, c.newJobs])).toEqual([['c', 9], ['a', 3], ['b', 3]])
  })

  it('leaves out companies without a company page worth indexing, and ones with no name or slug', () => {
    const out = shapeNewRolesCompanies(
      [group('a', 5), group('b', 4), group('c', 3), group('d', 2), group(null, 8), group('gone', 7)],
      [company('a'), company('b'), company('c', { name: '  ' }), company('d', { slug: null })],
      new Set(['a', 'c', 'd', 'gone']),
    )
    expect(out.map((c) => c.id)).toEqual(['a'])
  })

  it('caps the list', () => {
    const ids = Array.from({ length: NEW_ROLES_LIMIT + 10 }, (_, i) => `c${i}`)
    const out = shapeNewRolesCompanies(ids.map((id) => group(id, 1)), ids.map((id) => company(id)), new Set(ids))
    expect(out).toHaveLength(NEW_ROLES_LIMIT)
  })
})

describe('loadNewRolesByCompany', () => {
  it('counts public jobs added in the last 24 hours, then caches', async () => {
    mockGroupBy.mockResolvedValue([group('a', 6), group('b', 2)])
    mockFindMany.mockResolvedValue([company('a'), company('b')])
    const where = { isExpired: false }

    const out = await loadNewRolesByCompany(where, ['a'])
    expect(out.map((c) => c.id)).toEqual(['a'])

    const args = mockGroupBy.mock.calls[0][0]
    expect(args.by).toEqual(['companyId'])
    const clause = args.where.AND[1]
    expect(args.where.AND[0]).toBe(where)
    expect(clause.companyId).toEqual({ not: null })
    const ageMs = Date.now() - clause.createdAt.gte.getTime()
    expect(ageMs).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 5_000)
    expect(ageMs).toBeLessThan(24 * 60 * 60 * 1000 + 5_000)

    await loadNewRolesByCompany(where, ['a'])
    expect(mockGroupBy).toHaveBeenCalledTimes(1)
  })

  it('skips the company lookup when nothing was added', async () => {
    mockGroupBy.mockResolvedValue([])
    expect(await loadNewRolesByCompany({}, ['a'])).toEqual([])
    expect(mockFindMany).not.toHaveBeenCalled()
  })
})
