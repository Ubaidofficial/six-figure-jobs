// lib/runtime/stallWatch.ts
//
// Production pages stall for 10-60 s now and then (measured 2026-11-20) and the cause is not known: a blocked server process, the
// container's CPU or memory limit, or the database. This writes one log line whenever the server's event loop was blocked for
// STALL_LOG_MS or more within a 10 s window, with what is needed to tell those apart afterwards: the longest block, the process
// memory, how often the container's CPU limit throttled it in the window, how close the container is to its memory limit, and
// the uptime (a stall shortly after a restart points at start-up load). A window with no block writes nothing. If requests are
// slow while no `[stall]` line appears, the event loop was free and the wait was on the database (see SLOW_QUERY_LOG_MS in
// lib/prisma.ts). It reads two small cgroup files per window and keeps one histogram: no measurable cost.
import { readFileSync } from 'node:fs'
import { loadavg } from 'node:os'
import { monitorEventLoopDelay } from 'node:perf_hooks'

export type CgroupReading = {
  throttledCount: number | null
  throttledMs: number | null
  memoryBytes: number | null
  memoryLimitBytes: number | null
}

/** "key value" lines of a cgroup stat file as numbers (pure). */
export function parseStatFile(text: string | null): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of (text ?? '').split('\n')) {
    const m = /^(\w+)\s+(\d+)\s*$/.exec(line)
    if (m) out[m[1]] = Number(m[2])
  }
  return out
}

const read = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

const numberOrNull = (text: string | null): number | null => {
  const n = Number((text ?? '').trim())
  return text != null && Number.isFinite(n) && text.trim() !== '' ? n : null // "max" (no limit) is null
}

/** The container's CPU-throttle counters and memory use (cgroup v2); every field is null where it cannot be read. */
export function readCgroup(): CgroupReading {
  const cpu = parseStatFile(read('/sys/fs/cgroup/cpu.stat'))
  return {
    throttledCount: cpu.nr_throttled ?? null,
    throttledMs: cpu.throttled_usec != null ? cpu.throttled_usec / 1000 : null,
    memoryBytes: numberOrNull(read('/sys/fs/cgroup/memory.current')),
    memoryLimitBytes: numberOrNull(read('/sys/fs/cgroup/memory.max')),
  }
}

export type StallFacts = {
  maxMs: number
  p99Ms: number
  windowMs: number
  uptimeS: number
  rssMb: number
  heapUsedMb: number
  load1: number
  throttledCount: number | null
  throttledMs: number | null
  memoryMb: number | null
  memoryLimitMb: number | null
}

/** The log line (pure). */
export function formatStall(f: StallFacts): string {
  const throttle = f.throttledCount == null ? 'unknown' : `${f.throttledCount}x/${Math.round(f.throttledMs ?? 0)}ms`
  const memory = f.memoryMb == null ? 'unknown' : `${Math.round(f.memoryMb)}${f.memoryLimitMb == null ? '' : `/${Math.round(f.memoryLimitMb)}`}MB`
  return (
    `[stall] event loop blocked max=${Math.round(f.maxMs)}ms p99=${Math.round(f.p99Ms)}ms in the last ${Math.round(f.windowMs / 1000)}s; ` +
    `uptime=${Math.round(f.uptimeS)}s rss=${Math.round(f.rssMb)}MB heapUsed=${Math.round(f.heapUsedMb)}MB container_memory=${memory} ` +
    `cpu_throttled=${throttle} load1=${f.load1.toFixed(2)}`
  )
}

const MB = 1024 * 1024

export function startStallWatch(opts: { intervalMs?: number; thresholdMs?: number; log?: (line: string) => void } = {}): () => void {
  const intervalMs = opts.intervalMs ?? 10_000
  const thresholdMs = opts.thresholdMs ?? 500
  const log = opts.log ?? ((line: string) => console.warn(line))
  const histogram = monitorEventLoopDelay({ resolution: 10 })
  histogram.enable()
  let last = readCgroup()
  let lastAt = Date.now()
  const timer = setInterval(() => {
    const now = Date.now()
    const maxMs = histogram.max / 1e6
    const p99Ms = histogram.percentile(99) / 1e6
    histogram.reset()
    const cg = readCgroup()
    if (maxMs >= thresholdMs) {
      const mem = process.memoryUsage()
      log(
        formatStall({
          maxMs,
          p99Ms,
          windowMs: now - lastAt,
          uptimeS: process.uptime(),
          rssMb: mem.rss / MB,
          heapUsedMb: mem.heapUsed / MB,
          load1: loadavg()[0],
          throttledCount: cg.throttledCount != null && last.throttledCount != null ? cg.throttledCount - last.throttledCount : null,
          throttledMs: cg.throttledMs != null && last.throttledMs != null ? cg.throttledMs - last.throttledMs : null,
          memoryMb: cg.memoryBytes != null ? cg.memoryBytes / MB : null,
          memoryLimitMb: cg.memoryLimitBytes != null ? cg.memoryLimitBytes / MB : null,
        }),
      )
    }
    last = cg
    lastAt = now
  }, intervalMs)
  timer.unref()
  return () => {
    clearInterval(timer)
    histogram.disable()
  }
}
