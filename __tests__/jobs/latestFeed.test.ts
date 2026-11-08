const mockQuery = jest.fn()
jest.mock('@/lib/jobs/queryJobs', () => ({ queryJobs: (...a: unknown[]) => mockQuery(...a) }))

import { __clearMemoForTests } from '@/lib/cache/memo'
import {
  FEED_SIZE,
  LATEST_FEED_TTL_MS,
  buildFeedItems,
  formatAgo,
  loadLatestFeed,
  newestAddedAt,
} from '@/lib/jobs/latestFeed'

const job = (over: Record<string, unknown> = {}) =>
  ({
    id: 'j1',
    title: 'Senior Engineer',
    company: 'Acme',
    companyId: 'c1',
    companyRef: null,
    companyLogo: null,
    countryCode: 'US',
    locationRaw: 'Austin, TX',
    city: 'Austin',
    remote: false,
    remoteMode: 'onsite',
    minAnnual: 150000n,
    maxAnnual: 200000n,
    currency: 'USD',
    createdAt: new Date('2026-11-06T10:00:00Z'),
    postedAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-06T11:00:00Z'),
    ...over,
  }) as any

beforeEach(() => {
  __clearMemoForTests()
  mockQuery.mockReset()
})

describe('buildFeedItems', () => {
  it('maps a job to what the feed shows, timed by when WE added it', () => {
    const [item] = buildFeedItems([job()])
    expect(item).toMatchObject({
      id: 'j1',
      title: 'Senior Engineer',
      company: 'Acme',
      countryCode: 'US',
      addedAt: '2026-11-06T10:00:00.000Z', // createdAt, not the source's older postedAt
    })
    expect(item.href).toMatch(/^\/job\/senior-engineer-j-/)
    expect(item.salary).toMatch(/150/)
    expect(item.location).toContain('Austin')
  })

  it('prefers the company record name, and shows a remote job as Remote', () => {
    const [item] = buildFeedItems([job({ companyRef: { id: 'c1', name: 'Acme Pay', logoUrl: null, website: null }, remote: true, remoteMode: 'remote' })])
    expect(item.company).toBe('Acme Pay')
    expect(item.location).toMatch(/^Remote/)
  })

  it('has no salary text when the job states none', () => {
    const [item] = buildFeedItems([job({ minAnnual: null, maxAnnual: null, salaryMin: null, salaryMax: null })])
    expect(item.salary).toBeNull()
  })

  it('keeps the newest-first order, lets one employer fill at most two rows, and drops repeats of the same title', () => {
    const jobs = [
      job({ id: 'a1', title: 'Role A' }),
      job({ id: 'a2', title: 'Role B' }),
      job({ id: 'a3', title: 'Role C' }), // third from the same company: skipped
      job({ id: 'a4', title: 'Role A', companyId: 'c2', company: 'Other' }),
      job({ id: 'a5', title: 'Role A', companyId: 'c2', company: 'Other' }), // same company + title: skipped
    ]
    expect(buildFeedItems(jobs).map((i) => i.id)).toEqual(['a1', 'a2', 'a4'])
  })

  it('stops at the limit, and skips jobs with no date or no title', () => {
    const many = Array.from({ length: 40 }, (_, i) => job({ id: `x${i}`, title: `T${i}`, companyId: `c${i}` }))
    expect(buildFeedItems(many)).toHaveLength(FEED_SIZE)
    const bad = [job({ id: 'n1', createdAt: null, postedAt: null, updatedAt: null }), job({ id: 'n2', title: '  ' }), job({ id: 'ok' })]
    expect(buildFeedItems(bad).map((i) => i.id)).toEqual(['ok'])
  })
})

describe('newestAddedAt', () => {
  it('is the latest time, and null for an empty list', () => {
    expect(newestAddedAt([{ addedAt: '2026-11-06T10:00:00.000Z' }, { addedAt: '2026-11-06T12:00:00.000Z' }, { addedAt: '2026-11-05T00:00:00.000Z' }])).toBe(
      '2026-11-06T12:00:00.000Z',
    )
    expect(newestAddedAt([])).toBeNull()
  })
})

describe('formatAgo', () => {
  const now = Date.parse('2026-11-06T12:00:00Z')
  it.each([
    ['2026-11-06T11:59:30Z', 'just now'],
    ['2026-11-06T12:30:00Z', 'just now'], // a clock a little ahead of ours is never "in the future"
    ['2026-11-06T11:55:00Z', '5 min ago'],
    ['2026-11-06T09:00:00Z', '3 hr ago'],
    ['2026-11-05T11:00:00Z', '1 day ago'],
    ['2026-11-01T12:00:00Z', '5 days ago'],
    ['not a date', 'just now'],
  ])('%s -> %s', (iso, text) => {
    expect(formatAgo(iso, now)).toBe(text)
  })
})

describe('loadLatestFeed', () => {
  it('uses the homepage population, newest first, and queries the database once a minute at most', async () => {
    mockQuery.mockResolvedValue({ jobs: [job({ id: 'n', createdAt: new Date('2026-11-06T12:00:00Z') }), job({ id: 'o', title: 'Older' })] })
    const first = await loadLatestFeed()
    expect(first.newestAt).toBe('2026-11-06T12:00:00.000Z')
    expect(first.items.map((i) => i.id)).toEqual(['n', 'o'])
    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ isHundredKLocal: true, sortBy: 'date', excludeInternships: true }))
    expect(await loadLatestFeed()).toBe(first)
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(LATEST_FEED_TTL_MS).toBe(60_000)
  })
})

describe('buildFeedItems: featured jobs first', () => {
  it('takes English jobs with a real role before German agency ads, then shows them newest first', () => {
    // Newest first, as queryJobs returns them: the three ads are newer than every featured job.
    const ads = [2, 1, 0].map((i) =>
      job({ id: `de${i}`, title: `Facharzt (m/w/d) ${i}`, companyId: `d${i}`, roleSlug: 'other', createdAt: new Date(`2026-11-08T2${i}:00:00Z`) }),
    )
    const roles = [2, 1, 0].map((i) =>
      job({ id: `en${i}`, title: `Data Engineer ${i}`, companyId: `e${i}`, roleSlug: 'data-engineer', createdAt: new Date(`2026-11-08T0${i}:00:00Z`) }),
    )
    const items = buildFeedItems([...ads, ...roles] as never, 4)
    expect(items.map((i) => i.id)).toEqual(['de2', 'en2', 'en1', 'en0'])
  })
})
