// lib/runtime/warmPages.ts
//
// After a deploy every page cache is empty, so the first visitors and crawlers each wait for a full render, and a crowd
// of them rendering at once ran the server out of memory on 2026-11-11 (crash loop, about 40 minutes of 502s). Just
// after the server starts, instrumentation.ts requests the busiest pages here one at a time, so their caches (the ISR
// page and the memoized queries under it) are filled before the crowd arrives, without adding a crowd of its own.

/** The pages crawlers and visitors ask for first, in order. One request at a time. */
export const WARM_PATHS = [
  '/',
  '/jobs',
  '/remote',
  '/companies',
  '/salary',
  '/high-paying-jobs',
  '/jobs/100k-plus',
  '/jobs/200k-plus',
  '/jobs/location/united-states',
  '/jobs/software-engineer',
  '/sitemap.xml',
  '/sitemap-jobs.xml',
] as const

export const WARM_USER_AGENT = '6figjobs-warmup/1.0'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

/**
 * Requests each path in turn and returns how each went. Never throws: a failed warm-up only means a cold first visit.
 * The first request is retried while the server is still starting to listen.
 */
export async function warmPages(
  base: string,
  paths: readonly string[] = WARM_PATHS,
  fetchImpl: Fetch = fetch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Array<{ path: string; status: number | null; ms: number }>> {
  const results: Array<{ path: string; status: number | null; ms: number }> = []
  for (const [i, path] of paths.entries()) {
    const started = Date.now()
    let status: number | null = null
    for (let attempt = 0; attempt < (i === 0 ? 5 : 1) && status === null; attempt++) {
      if (attempt > 0) await wait(2000)
      try {
        const res = await fetchImpl(`${base}${path}`, {
          headers: { 'user-agent': WARM_USER_AGENT },
          signal: AbortSignal.timeout(60_000),
        })
        await res.arrayBuffer()
        status = res.status
      } catch {
        status = null
      }
    }
    results.push({ path, status, ms: Date.now() - started })
  }
  return results
}
