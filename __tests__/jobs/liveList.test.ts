import { formatAgo } from '../../lib/jobs/formatAgo'
import { formatAgo as formatAgoFromFeed } from '../../lib/jobs/latestFeed'
import { MAX_ARRIVALS, REVEAL_STEP, newArrivals, newestAddedIso, rankTime, revealMore, shouldInsertNow } from '../../lib/jobs/liveList'

jest.mock('../../lib/prisma', () => ({ prisma: {} }))

describe('revealMore', () => {
  it('shows 5 at first and 5 more each time', () => {
    expect(REVEAL_STEP).toBe(5)
    expect(revealMore(5, 24)).toBe(10)
    expect(revealMore(20, 24)).toBe(24)
  })
  it('never shows more than there are, nor fewer than it had', () => {
    expect(revealMore(5, 3)).toBe(3)
    expect(revealMore(24, 24)).toBe(24)
    expect(revealMore(0, 0)).toBe(0)
  })
})

describe('newArrivals', () => {
  it('keeps jobs the list does not have, in the page order, once each', () => {
    const fetched = [{ id: 'n2' }, { id: 'n1' }, { id: 'a' }, { id: 'n1' }, { id: 'b' }]
    expect(newArrivals(fetched, new Set(['a', 'b']))).toEqual([{ id: 'n2' }, { id: 'n1' }])
  })
  it('gives nothing when the page holds only known jobs, or bad rows', () => {
    expect(newArrivals([{ id: 'a' }], new Set(['a']))).toEqual([])
    expect(newArrivals([{ id: '' }, null as unknown as { id: string }], new Set())).toEqual([])
  })
  it('counts a job only if it ranks at or above the list\'s first job (a stale answer\'s older jobs are not new)', () => {
    const top = rankTime({ postedAt: '2026-11-21T10:00:00.000Z' })
    const fetched = [
      { id: 'new', postedAt: '2026-11-21T11:00:00.000Z' },
      { id: 'same', postedAt: '2026-11-21T10:00:00.000Z' },
      { id: 'fellOffTheEnd', postedAt: '2026-11-20T08:00:00.000Z' },
      { id: 'undatedNew', createdAt: '2026-11-21T12:00:00.000Z' },
    ]
    expect(newArrivals(fetched, new Set(), top).map((j) => j.id)).toEqual(['new', 'same', 'undatedNew'])
  })
  it('takes at most MAX_ARRIVALS at once', () => {
    const fetched = Array.from({ length: MAX_ARRIVALS + 5 }, (_, i) => ({ id: `j${i}` }))
    expect(newArrivals(fetched, new Set())).toHaveLength(MAX_ARRIVALS)
  })
})

describe('newestAddedIso', () => {
  it('is the latest time we added a job, whichever field carries it', () => {
    expect(
      newestAddedIso([
        { createdAt: '2026-11-20T10:00:00.000Z' },
        { createdAt: new Date('2026-11-21T01:00:00.000Z') },
        { postedAt: '2026-11-19T00:00:00.000Z' },
      ]),
    ).toBe('2026-11-21T01:00:00.000Z')
  })
  it('is null when no job has a usable time', () => {
    expect(newestAddedIso([])).toBeNull()
    expect(newestAddedIso([{ createdAt: 'not a date' }, {}])).toBeNull()
  })
})

describe('shouldInsertNow', () => {
  it('puts new jobs in only when the list is idle and the reader is at the top', () => {
    expect(shouldInsertNow({ holding: false, paused: false, scrolledPastTop: false })).toBe(true)
    expect(shouldInsertNow({ holding: true, paused: false, scrolledPastTop: false })).toBe(false)
    expect(shouldInsertNow({ holding: false, paused: true, scrolledPastTop: false })).toBe(false)
    expect(shouldInsertNow({ holding: false, paused: false, scrolledPastTop: true })).toBe(false)
  })
})

describe('formatAgo', () => {
  it('is the same function from both modules (the homepage feed still imports it from latestFeed)', () => {
    expect(formatAgoFromFeed).toBe(formatAgo)
    expect(formatAgo('2026-11-21T00:00:00.000Z', Date.parse('2026-11-21T00:05:00.000Z'))).toBe('5 min ago')
  })
})
