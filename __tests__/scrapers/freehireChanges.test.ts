import { FIRST_RUN_LOOKBACK_HOURS, latestBySlug, syncFreehireChanges, type FeedChange, type FeedPage, type OurJob } from '../../lib/scrapers/freehireChanges'

jest.mock('../../lib/prisma', () => ({ prisma: {} }))
jest.mock('../../lib/jobs/expiry', () => ({ expireJobsByIds: jest.fn() }))

const ch = (slug: string, seq: number, kind: string): FeedChange => ({ public_slug: slug, seq, kind, at: '2026-11-22T20:00:00Z' })
const ours = (slug: string): OurJob => ({ id: `id-${slug}`, title: `Job ${slug}`, externalId: `ext-${slug}`, sourceRef: slug })

/** A feed of pages; each page's next_cursor is "c<index>". */
function feed(pages: FeedChange[][]) {
  const calls: Array<{ cursor?: string; since?: string }> = []
  const fetchPage = async (position: { cursor?: string; since?: string }): Promise<FeedPage> => {
    calls.push(position)
    const i = position.cursor ? Number(position.cursor.slice(1)) + 1 : 0
    return { data: pages[i] ?? [], meta: { has_more: i < pages.length - 1, next_cursor: `c${i}` } }
  }
  return { fetchPage, calls }
}

function deps(over: Record<string, unknown> = {}) {
  const saved: string[] = []
  const expired: string[][] = []
  return {
    saved,
    expired,
    options: {
      loadCursor: async () => 'c-start' as string | null,
      saveCursor: async (c: string) => void saved.push(c),
      findActiveBySlugs: async (slugs: string[]) => slugs.filter((s) => s.startsWith('our')).map(ours),
      countActive: async () => 1000,
      stillListed: async () => false as boolean | null,
      expire: async (ids: string[]) => {
        expired.push(ids)
        return { expired: ids.length }
      },
      ...over,
    },
  }
}

describe('latestBySlug', () => {
  it('keeps the highest seq per posting, in any order', () => {
    const m = latestBySlug([ch('a', 5, 'closed'), ch('a', 7, 'reopened'), ch('b', 3, 'closed'), ch('a', 6, 'closed')])
    expect(m.get('a')?.kind).toBe('reopened')
    expect(m.get('b')?.kind).toBe('closed')
  })
})

describe('syncFreehireChanges', () => {
  it('expires our jobs whose latest change is a closing and that search no longer lists, then saves the cursor', async () => {
    const { fetchPage } = feed([[ch('our-1', 1, 'closed'), ch('other', 2, 'closed')], [ch('our-2', 3, 'closed'), ch('our-3', 4, 'closed'), ch('our-3', 5, 'reopened')]])
    const d = deps({ loadCursor: async () => null, stillListed: async (title: string) => (title === 'Job our-2' ? true : false) })
    const r = await syncFreehireChanges({ ...d.options, fetchPage })
    expect(r.status).toBe('ok')
    expect(r.pages).toBe(2)
    expect(r.caughtUp).toBe(true)
    expect(r.closedInFeed).toBe(3) // our-1, other, our-2 (our-3 reopened later)
    expect(r.closed.map((j) => j.sourceRef)).toEqual(['our-1'])
    expect(r.conflicts.map((j) => j.sourceRef)).toEqual(['our-2'])
    expect(d.expired).toEqual([['id-our-1']])
    expect(d.saved).toEqual(['c1'])
  })

  it('starts the first run (no stored cursor) from the last day', async () => {
    const { fetchPage, calls } = feed([[]])
    const now = Date.parse('2026-11-23T00:00:00Z')
    await syncFreehireChanges({ ...deps({ loadCursor: async () => null }).options, fetchPage, now: () => now })
    expect(calls[0]).toEqual({ since: new Date(now - FIRST_RUN_LOOKBACK_HOURS * 3_600_000).toISOString() })
  })

  it('resumes from the stored cursor', async () => {
    const { fetchPage, calls } = feed([[ch('x', 1, 'opened')], [ch('y', 2, 'opened')]])
    const d = deps({ loadCursor: async () => 'c0' })
    const r = await syncFreehireChanges({ ...d.options, fetchPage })
    expect(calls[0]).toEqual({ cursor: 'c0' })
    expect(r.pages).toBe(1)
    expect(d.saved).toEqual(['c1'])
  })

  it('a dry run expires nothing and leaves the cursor where it was', async () => {
    const { fetchPage } = feed([[ch('our-1', 1, 'closed')]])
    const d = deps({ loadCursor: async () => null })
    const r = await syncFreehireChanges({ ...d.options, fetchPage, dryRun: true })
    expect(r.closed).toHaveLength(1)
    expect(d.expired).toEqual([])
    expect(d.saved).toEqual([])
  })

  it('applies what was read when the feed fails part-way, and saves the cursor just past it', async () => {
    let n = 0
    const fetchPage = async (): Promise<FeedPage> => {
      if (n++ === 0) return { data: [ch('our-1', 1, 'closed')], meta: { has_more: true, next_cursor: 'c0' } }
      throw new Error('boom')
    }
    const d = deps({ loadCursor: async () => null })
    const r = await syncFreehireChanges({ ...d.options, fetchPage })
    expect(r.status).toBe('ok')
    expect(r.reason).toMatch(/stopped early/)
    expect(d.expired).toEqual([['id-our-1']])
    expect(d.saved).toEqual(['c0'])
  })

  it('aborts above the safety limit: nothing expired, cursor kept', async () => {
    const closings = Array.from({ length: 30 }, (_, i) => ch(`our-${i}`, i + 1, 'closed'))
    const { fetchPage } = feed([closings])
    const d = deps({ loadCursor: async () => null, countActive: async () => 100 })
    const r = await syncFreehireChanges({ ...d.options, fetchPage })
    expect(r.status).toBe('aborted')
    expect(d.expired).toEqual([])
    expect(d.saved).toEqual([])
  })

  it('skips when too many searches fail: a failed search never expires a job', async () => {
    const { fetchPage } = feed([[ch('our-1', 1, 'closed'), ch('our-2', 2, 'closed')]])
    const d = deps({ loadCursor: async () => null, stillListed: async () => null })
    const r = await syncFreehireChanges({ ...d.options, fetchPage })
    expect(r.status).toBe('skipped')
    expect(d.expired).toEqual([])
    expect(d.saved).toEqual([])
  })

  it('stops at maxPages and leaves the rest for the next run', async () => {
    const { fetchPage } = feed([[ch('a', 1, 'opened')], [ch('b', 2, 'opened')], [ch('c', 3, 'opened')]])
    const d = deps({ loadCursor: async () => null })
    const r = await syncFreehireChanges({ ...d.options, fetchPage, maxPages: 2 })
    expect(r.pages).toBe(2)
    expect(r.caughtUp).toBe(false)
    expect(d.saved).toEqual(['c1'])
  })
})
