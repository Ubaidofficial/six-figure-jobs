import { __clearMemoForTests, memoAsync, stableKey } from '../../lib/cache/memo'

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
