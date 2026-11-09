import { DEFAULT_DELETE_SHARE, parseDeleteShare, selectIndexingBatch, type QueueCandidate } from '../../lib/indexing/queueSelection'

const day = (d: number) => new Date(Date.UTC(2026, 10, d, 12, 0, 0))
const make = (prefix: string, type: string, n: number, startDay: number): QueueCandidate[] =>
  // one record per hour, so createdAt strictly increases with the index
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${String(i).padStart(3, '0')}`,
    type,
    createdAt: new Date(day(startDay).getTime() + i * 3_600_000),
  }))
const typeOf = (all: QueueCandidate[], id: string) => all.find((c) => c.id === id)!.type

describe('selectIndexingBatch', () => {
  // 2026-11-09: 120 quota left, 180 new pages queued that morning, a pile of removals queued over the days before.
  const removals = make('del', 'URL_DELETED', 300, 3)
  const pages = make('upd', 'URL_UPDATED', 180, 9)
  const all = [...removals, ...pages]

  it('sends new pages first and keeps only the reserved share for removals (the bug this replaces)', () => {
    const ids = selectIndexingBatch(all, { batchLimit: 120, deleteBudget: 36 })
    const types = ids.map((id) => typeOf(all, id))
    expect(ids).toHaveLength(120)
    expect(types.filter((t) => t === 'URL_UPDATED')).toHaveLength(84)
    expect(types.filter((t) => t === 'URL_DELETED')).toHaveLength(36)
    // pages come before removals in the order to process
    expect(types.indexOf('URL_DELETED')).toBe(84)
  })

  it('takes the newest pages and the oldest removals', () => {
    const ids = selectIndexingBatch(all, { batchLimit: 120, deleteBudget: 36 })
    expect(ids[0]).toBe('upd179')
    expect(ids[83]).toBe('upd096')
    expect(ids[84]).toBe('del000')
    expect(ids[119]).toBe('del035')
  })

  it('gives quota the new pages do not need to removals instead of wasting it', () => {
    const few = [...removals, ...make('upd', 'URL_UPDATED', 10, 9)]
    const ids = selectIndexingBatch(few, { batchLimit: 120, deleteBudget: 36 })
    const types = ids.map((id) => typeOf(few, id))
    expect(ids).toHaveLength(120)
    expect(types.filter((t) => t === 'URL_UPDATED')).toHaveLength(10)
    expect(types.filter((t) => t === 'URL_DELETED')).toHaveLength(110)
  })

  it('sends no reserved removals once the day’s removal share is used, but still fills spare quota with them', () => {
    const ids = selectIndexingBatch(all, { batchLimit: 120, deleteBudget: 0 })
    expect(ids.map((id) => typeOf(all, id)).every((t) => t === 'URL_UPDATED')).toBe(true)
    expect(ids).toHaveLength(120)
    const few = make('upd', 'URL_UPDATED', 5, 9).concat(removals)
    expect(selectIndexingBatch(few, { batchLimit: 20, deleteBudget: 0 })).toHaveLength(20)
  })

  it('never exceeds the batch limit, repeats an id, or invents one', () => {
    for (const [batchLimit, deleteBudget] of [[1, 36], [36, 36], [37, 36], [500, 36], [120, 1000]] as const) {
      const ids = selectIndexingBatch(all, { batchLimit, deleteBudget })
      expect(ids.length).toBeLessThanOrEqual(batchLimit)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.every((id) => all.some((c) => c.id === id))).toBe(true)
    }
  })

  it('returns nothing when there is no quota or no queue', () => {
    expect(selectIndexingBatch(all, { batchLimit: 0, deleteBudget: 36 })).toEqual([])
    expect(selectIndexingBatch(all, { batchLimit: -5, deleteBudget: 36 })).toEqual([])
    expect(selectIndexingBatch([], { batchLimit: 120, deleteBudget: 36 })).toEqual([])
  })

  it('keeps types it does not know in the main share, so the worker can skip them', () => {
    const odd: QueueCandidate = { id: 'odd001', type: 'URL_SOMETHING', createdAt: day(9) }
    expect(selectIndexingBatch([odd, ...removals], { batchLimit: 10, deleteBudget: 3 })).toContain('odd001')
  })
})

describe('parseDeleteShare', () => {
  it('uses the default when unset, empty or not a number', () => {
    expect(parseDeleteShare(undefined)).toBe(DEFAULT_DELETE_SHARE)
    expect(parseDeleteShare('')).toBe(DEFAULT_DELETE_SHARE)
    expect(parseDeleteShare('lots')).toBe(DEFAULT_DELETE_SHARE)
  })

  it('reads a number and clamps it to 0..1', () => {
    expect(parseDeleteShare('0.5')).toBe(0.5)
    expect(parseDeleteShare('0')).toBe(0)
    expect(parseDeleteShare('7')).toBe(1)
    expect(parseDeleteShare('-2')).toBe(0)
  })
})
