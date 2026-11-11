import { MAX_ENTRIES, MAX_STALE_MS, __clearMemoForTests, memoAsync, stableKey } from '../../lib/cache/memo'

describe('memoAsync', () => {
  beforeEach(() => __clearMemoForTests())

  it('loads once inside the TTL and again after it', async () => {
    const loader = jest.fn(async () => 'v')
    let t = 0
    const now = () => t
    await memoAsync('k', 1000, loader, now)
    t = 999
    await memoAsync('k', 1000, loader, now)
    expect(loader).toHaveBeenCalledTimes(1)
    t = 1001
    await memoAsync('k', 1000, loader, now)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('serves a stale value at once and refreshes it in the background', async () => {
    let finishRefresh!: (v: string) => void
    const loader = jest
      .fn<Promise<string>, []>()
      .mockResolvedValueOnce('v1')
      .mockImplementationOnce(() => new Promise<string>((r) => (finishRefresh = r)))
    let t = 0
    const now = () => t
    expect(await memoAsync('k', 1000, loader, now)).toBe('v1')
    t = 1500 // past the TTL, within MAX_STALE_MS
    expect(await memoAsync('k', 1000, loader, now)).toBe('v1') // no wait while the refresh runs
    expect(await memoAsync('k', 1000, loader, now)).toBe('v1') // and the refresh is not started twice
    expect(loader).toHaveBeenCalledTimes(2)
    finishRefresh('v2')
    await new Promise((r) => setImmediate(r))
    expect(await memoAsync('k', 1000, loader, now)).toBe('v2')
  })

  it('waits for a fresh load when the entry is too old to serve', async () => {
    let n = 0
    const loader = jest.fn(async () => `v${++n}`)
    let t = 0
    const now = () => t
    await memoAsync('k', 1000, loader, now)
    t = 1000 + MAX_STALE_MS + 1
    expect(await memoAsync('k', 1000, loader, now)).toBe('v2')
  })

  it('keeps the stale value when a background refresh fails', async () => {
    const loader = jest.fn().mockResolvedValueOnce('old').mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce('new')
    let t = 0
    const now = () => t
    await memoAsync('k', 1000, loader, now)
    t = 1500
    expect(await memoAsync('k', 1000, loader, now)).toBe('old')
    await new Promise((r) => setImmediate(r))
    expect(await memoAsync('k', 1000, loader, now)).toBe('old') // retries in the background
    await new Promise((r) => setImmediate(r))
    expect(await memoAsync('k', 1000, loader, now)).toBe('new')
  })

  it('shares one load between concurrent callers', async () => {
    let resolve!: (v: string) => void
    const loader = jest.fn(() => new Promise<string>((r) => (resolve = r)))
    const a = memoAsync('k', 1000, loader)
    const b = memoAsync('k', 1000, loader)
    resolve('shared')
    expect(await a).toBe('shared')
    expect(await b).toBe('shared')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('never caches a failure', async () => {
    const loader = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce('ok')
    await expect(memoAsync('k', 1000, loader)).rejects.toThrow('db down')
    expect(await memoAsync('k', 1000, loader)).toBe('ok')
  })

  it('keeps entries that are read and evicts the least recently used (a crawl of job pages no longer pushes out /jobs)', async () => {
    const hub = jest.fn(async () => 'hub')
    const once = jest.fn(async () => 'once')
    await memoAsync('jobs-hub', 60_000, hub)
    await memoAsync('read-once', 60_000, once)
    // A crawler adds more entries than the cache holds; the hub page is read now and then along the way.
    for (let i = 0; i < MAX_ENTRIES + 50; i++) {
      await memoAsync(`job-page-${i}`, 60_000, async () => i)
      if (i % 100 === 0) await memoAsync('jobs-hub', 60_000, hub)
    }
    await memoAsync('jobs-hub', 60_000, hub)
    expect(hub).toHaveBeenCalledTimes(1) // never evicted, never reloaded
    await memoAsync('read-once', 60_000, once)
    expect(once).toHaveBeenCalledTimes(2) // evicted, so loaded again
  })

  it('keeps different keys apart', async () => {
    expect(await memoAsync('a', 1000, async () => 1)).toBe(1)
    expect(await memoAsync('b', 1000, async () => 2)).toBe(2)
  })
})

describe('stableKey', () => {
  it('handles BigInt and Date and distinguishes inputs', () => {
    expect(stableKey('x', { n: BigInt(5), d: new Date('2026-01-01T00:00:00Z') })).toContain('5n')
    expect(stableKey('x', 1)).not.toBe(stableKey('x', 2))
  })
})
