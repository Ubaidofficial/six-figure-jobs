const count = jest.fn()
jest.mock('@/lib/prisma', () => ({ prisma: { job: { count: (...a: unknown[]) => count(...a) } } }))
jest.mock('@/lib/cache/memo', () => ({
  DEFAULT_TTL_MS: 1,
  stableKey: (...p: unknown[]) => JSON.stringify(p),
  memoAsync: (_k: string, _t: number, load: () => Promise<unknown>) => load(),
}))

import { loadRelatedSearches, rankRelatedSearches, relatedInput } from '@/lib/jobs/relatedSearches'

describe('rankRelatedSearches', () => {
  it('drops thin counted rows, sorts biggest first and keeps uncounted rows last', () => {
    const out = rankRelatedSearches([
      { label: 'Guide', href: '/salary/x' },
      { label: 'Small', href: '/a', count: 2 },
      { label: 'B', href: '/b', count: 10 },
      { label: 'A', href: '/c', count: 10 },
      { label: 'Big', href: '/d', count: 99 },
    ])
    expect(out.map((r) => r.label)).toEqual(['Big', 'A', 'B', 'Guide'])
  })

  it('caps the list', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ label: `L${i}`, href: `/${i}`, count: 100 - i }))
    expect(rankRelatedSearches(rows)).toHaveLength(7)
    expect(rankRelatedSearches(rows, { limit: 3 })).toHaveLength(3)
  })
})

// Each entry is the query its destination page runs for the unfiltered total it shows; a change to a page's query must
// change the entry (and this test) with it, or the card shows a number the page does not.
describe('relatedInput mirrors the destination pages', () => {
  it('/jobs and /remote hubs', () => {
    expect(relatedInput.jobsHub()).toEqual({})
    expect(relatedInput.remoteHub()).toEqual({ remoteOnly: true, excludeInternships: true })
  })

  it('/jobs/<tier>: tierQueryInput (USD, top of the range inside the tier)', () => {
    expect(relatedInput.tier('100k-plus')).toEqual({ currency: 'USD', minAnnual: 100_000, maxAnnual: 199_999 })
    expect(relatedInput.tier('200k-plus')).toEqual({ currency: 'USD', minAnnual: 200_000, maxAnnual: 299_999 })
    expect(relatedInput.tier('300k-plus')).toEqual({ currency: 'USD', minAnnual: 300_000, maxAnnual: 399_999 })
    expect(relatedInput.tier('400k-plus')).toEqual({ currency: 'USD', minAnnual: 400_000 })
  })

  it('/jobs/category/<category>: the category roles, $100k+ local', () => {
    expect(relatedInput.category(['data-scientist', 'data-engineer'])).toEqual({
      roleSlugs: ['data-scientist', 'data-engineer'],
      isHundredKLocal: true,
    })
  })

  it('/jobs/level/<level>: the experience level, $100k+ local', () => {
    expect(relatedInput.level('senior')).toEqual({ experienceLevel: 'senior', isHundredKLocal: true })
  })

  it('city, role x city, skill, role and remote role pages', () => {
    expect(relatedInput.city('london', 'GB')).toEqual({ citySlug: 'london', countryCode: 'GB', isHundredKLocal: true })
    expect(relatedInput.roleCity('data-engineer', 'london')).toEqual({
      roleSlugs: ['data-engineer'],
      citySlug: 'london',
      isHundredKLocal: true,
    })
    expect(relatedInput.skill('python')).toEqual({ skillSlugs: ['python'], isHundredKLocal: true })
    expect(relatedInput.role('data-engineer')).toEqual({ roleSlugs: ['data-engineer'] })
    expect(relatedInput.remoteRole('data-engineer')).toEqual({ roleSlugs: ['data-engineer'], remoteOnly: true })
  })
})

describe('loadRelatedSearches', () => {
  beforeEach(() => count.mockReset())

  it('counts each spec with its own query, skips the excluded page and duplicates', async () => {
    count.mockResolvedValue(42)
    const out = await loadRelatedSearches(
      [
        { label: 'Self', href: '/jobs/x/', input: relatedInput.role('x') },
        { label: 'Remote X', href: '/remote/x', input: relatedInput.remoteRole('x') },
        { label: 'Remote X again', href: '/remote/x?page=2', input: relatedInput.remoteRole('x') },
        { label: 'Guide', href: '/salary/x' },
      ],
      { exclude: ['/jobs/x'] },
    )
    expect(out).toEqual([
      { label: 'Remote X', href: '/remote/x', count: 42 },
      { label: 'Guide', href: '/salary/x' },
    ])
    expect(count).toHaveBeenCalledTimes(1)
  })

  it('returns nothing when a count cannot be read', async () => {
    count.mockRejectedValue(new Error('db down'))
    await expect(loadRelatedSearches([{ label: 'A', href: '/a', input: relatedInput.country('US') }])).resolves.toEqual([])
  })
})
