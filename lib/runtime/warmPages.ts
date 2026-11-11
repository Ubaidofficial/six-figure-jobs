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
  gapMs = 0,
): Promise<Array<{ path: string; status: number | null; ms: number }>> {
  const results: Array<{ path: string; status: number | null; ms: number }> = []
  for (const [i, path] of paths.entries()) {
    if (i > 0 && gapMs > 0) await wait(gapMs)
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

/**
 * How often the hub pages are requested again. A cache entry is served for its TTL plus MAX_STALE_MS (one hour,
 * lib/cache/memo.ts); past that the next visitor waits for every query again. Hubs few people visit (salary bands,
 * cities, skills) went cold that way and took 10-19 s for Googlebot (measured 2026-11-11). Requesting them every 45
 * minutes keeps each one inside that window; each request serves the cached page and refreshes it in the background.
 */
export const REWARM_EVERY_MS = 45 * 60 * 1000

/** Pause between re-warm requests, so their background refreshes do not all hit the database at once. */
export const REWARM_GAP_MS = 2000

/** Sitemaps in the index that are not hub pages: one URL per job or company, far too many to keep warm. */
const NON_HUB_SITEMAP = /\/sitemap-(jobs|company)\b/

/** Paths of the <loc> URLs in a sitemap or sitemap index, in order, without duplicates. */
export function sitemapPaths(xml: string): string[] {
  const paths = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => {
    try {
      return new URL(m[1]).pathname
    } catch {
      return null
    }
  })
  return [...new Set(paths.filter((p): p is string => Boolean(p)))]
}

/**
 * Waits before each new try of a sitemap that came back with no URLs. Just after a restart, /sitemap-batch/<n>.xml
 * builds its page list from the database for the first time, and if that build fails or runs long it answers with an
 * empty <urlset> (lib/seo/evergreenSitemap.ts, app/sitemap-batch/[batch]/route.ts). On 2026-11-11 the first pass
 * after a deploy missed its 21 pages that way, and they waited 45 minutes for the next pass. The build keeps running
 * after the first request, so a later try gets the list.
 */
export const EMPTY_SITEMAP_RETRY_MS = [15_000, 30_000] as const

/**
 * The indexable hub pages: every page listed in the sitemap index's children, minus the job and company sitemaps.
 * Read from the running server, so the list follows the sitemaps (and the indexing phase) with no second copy here.
 * A sitemap with no URLs is tried again (EMPTY_SITEMAP_RETRY_MS). Never throws: a sitemap that still has none adds no
 * paths.
 */
export async function hubPaths(
  base: string,
  fetchImpl: Fetch = fetch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<string[]> {
  const read = async (path: string) => {
    try {
      const res = await fetchImpl(`${base}${path}`, {
        headers: { 'user-agent': WARM_USER_AGENT },
        signal: AbortSignal.timeout(60_000),
      })
      return res.status === 200 ? await res.text() : ''
    } catch {
      return ''
    }
  }
  const readPaths = async (path: string) => {
    let found = sitemapPaths(await read(path))
    for (const ms of EMPTY_SITEMAP_RETRY_MS) {
      if (found.length > 0) break
      await wait(ms)
      found = sitemapPaths(await read(path))
    }
    return found
  }
  const children = (await readPaths('/sitemap.xml')).filter((p) => !NON_HUB_SITEMAP.test(p))
  const paths: string[] = []
  for (const child of children) paths.push(...(await readPaths(child)))
  return [...new Set(paths.map((p) => (p === '' ? '/' : p)))]
}
