import { formatStall, parseStatFile, startStallWatch } from '../../lib/runtime/stallWatch'

const facts = {
  maxMs: 1234.4,
  p99Ms: 80,
  windowMs: 10_020,
  uptimeS: 95.2,
  rssMb: 512.3,
  heapUsedMb: 210.9,
  load1: 1.5,
  throttledCount: 7,
  throttledMs: 840.2,
  memoryMb: 900.1,
  memoryLimitMb: 2048,
}

describe('parseStatFile', () => {
  it('reads "key value" lines and ignores the rest', () => {
    expect(parseStatFile('usage_usec 100\nnr_throttled 3\nthrottled_usec 4500\nbad line\n')).toEqual({ usage_usec: 100, nr_throttled: 3, throttled_usec: 4500 })
  })
  it('gives an empty object for a missing file', () => {
    expect(parseStatFile(null)).toEqual({})
  })
})

describe('formatStall', () => {
  it('puts what tells the causes apart on one line', () => {
    const line = formatStall(facts)
    expect(line).toBe(
      '[stall] event loop blocked max=1234ms p99=80ms in the last 10s; uptime=95s rss=512MB heapUsed=211MB container_memory=900/2048MB cpu_throttled=7x/840ms load1=1.50',
    )
  })
  it('says "unknown" where the container figures cannot be read', () => {
    const line = formatStall({ ...facts, throttledCount: null, throttledMs: null, memoryMb: null, memoryLimitMb: null })
    expect(line).toContain('container_memory=unknown')
    expect(line).toContain('cpu_throttled=unknown')
  })
})

describe('startStallWatch', () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // Real timers: the delay comes from Node's native event-loop histogram, which fake timers cannot drive. An interval equal to
  // the histogram's 10 ms resolution makes the watcher's tick often run before the histogram records a block, the order that
  // used to lose it (histogram.reset() drops an unrecorded delay; 2026-11-25 CI flake). Waiting for the line with a deadline,
  // not a fixed sleep, keeps a slow runner from failing a correct watcher; the line still has to come from the block.
  it('logs when the event loop is blocked past the threshold, and not otherwise', async () => {
    const lines: string[] = []
    const stop = startStallWatch({ intervalMs: 10, thresholdMs: 150, log: (l) => lines.push(l) })
    try {
      await sleep(200) // idle: nothing to log
      expect(lines).toEqual([])
      const until = Date.now() + 300
      while (Date.now() < until) {
        /* block the event loop */
      }
      const deadline = Date.now() + 5_000
      while (lines.length === 0 && Date.now() < deadline) await sleep(20)
      expect(lines.length).toBeGreaterThanOrEqual(1)
      expect(lines[0]).toMatch(/^\[stall\] event loop blocked max=\d+ms/)
      expect(Number(/max=(\d+)ms/.exec(lines[0])?.[1])).toBeGreaterThanOrEqual(150)
    } finally {
      stop()
    }
  })
})
