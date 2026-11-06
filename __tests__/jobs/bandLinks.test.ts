const mockQuery = jest.fn()
jest.mock('@/lib/jobs/queryJobs', () => ({ queryJobs: (...a: unknown[]) => mockQuery(...a) }))

import { __clearMemoForTests } from '@/lib/cache/memo'
import { dropEmptyRoleBandLinks, parseRoleBandPath, roleBandHasJobs } from '@/lib/jobs/bandLinks'

beforeEach(() => {
  __clearMemoForTests()
  mockQuery.mockReset()
})

describe('parseRoleBandPath', () => {
  it('reads a role and the band floor from a role-band path', () => {
    expect(parseRoleBandPath('/jobs/data-scientist/400k-plus')).toEqual({ role: 'data-scientist', min: 400_000 })
    expect(parseRoleBandPath('/jobs/senior-software-engineer/100k-plus/')).toEqual({ role: 'senior-software-engineer', min: 100_000 })
  })
  it.each(['/jobs/400k-plus', '/jobs/location/canada', '/jobs/software-engineer', '/remote/software-engineer', '/jobs/a/b/400k-plus'])(
    'ignores %s',
    (href) => expect(parseRoleBandPath(href)).toBeNull(),
  )
})

describe('roleBandHasJobs', () => {
  it('asks the same question the page asks (role + minimum pay) and remembers the answer', async () => {
    mockQuery.mockResolvedValue({ total: 3 })
    expect(await roleBandHasJobs('data-scientist', 300_000)).toBe(true)
    expect(await roleBandHasJobs('data-scientist', 300_000)).toBe(true)
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ roleSlugs: ['data-scientist'], minAnnual: 300_000 }))
  })
  it('is false when the page would be empty (and so would redirect)', async () => {
    mockQuery.mockResolvedValue({ total: 0 })
    expect(await roleBandHasJobs('product-designer', 400_000)).toBe(false)
  })
})

describe('dropEmptyRoleBandLinks', () => {
  const links = [
    { href: '/jobs/data-scientist/400k-plus', n: 1 },
    { href: '/jobs/software-engineer/100k-plus', n: 2 },
    { href: '/jobs/location/canada', n: 3 },
  ]

  it('drops role-band links with no jobs, keeps the rest in order', async () => {
    const has = jest.fn(async (role: string) => role !== 'data-scientist')
    expect((await dropEmptyRoleBandLinks(links, has)).map((l) => l.n)).toEqual([2, 3])
    expect(has).toHaveBeenCalledTimes(2) // the location link is never checked
  })

  it('keeps a link when the check itself fails', async () => {
    const has = jest.fn(async () => {
      throw new Error('db down')
    })
    expect((await dropEmptyRoleBandLinks(links, has)).map((l) => l.n)).toEqual([1, 2, 3])
  })
})
