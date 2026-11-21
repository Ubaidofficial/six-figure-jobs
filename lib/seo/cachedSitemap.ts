// lib/seo/cachedSitemap.ts
//
// Sitemap routes are rendered per request (a deploy-time build cannot reach the database), so every fetch ran their queries
// again. Measured on production 2026-11-20: /sitemap.xml 34 s and 29 s on two requests in a row (it builds the salary,
// country and company sitemaps itself, 5.4 s, 2.7 s and 3.1 s each, to date its entries), which a crawler waits for and the
// warm-up repeats after every restart. This keeps a good answer for SITEMAP_TTL_MS and refreshes it in the background
// (lib/cache/memo.ts: stale-while-revalidate), and never keeps a bad one: a fallback, an error status or a file with no
// entries is returned once, and the next request builds again.
import { memoAsync } from '../cache/memo'

export const SITEMAP_TTL_MS = 10 * 60 * 1000

/** Thrown inside the loader so memoAsync keeps nothing; the caller then returns the answer it already built. */
class NotKept extends Error {}

const HAS_ENTRIES = /<(?:url|sitemap)>/

export async function cachedXmlResponse(key: string, build: () => Promise<Response>): Promise<Response> {
  let built: Response | null = null
  try {
    const kept = await memoAsync(`sitemap:${key}`, SITEMAP_TTL_MS, async () => {
      const res = await build()
      const body = await res.text()
      if (res.status !== 200 || !HAS_ENTRIES.test(body)) {
        built = new Response(body, { status: res.status, headers: res.headers })
        throw new NotKept()
      }
      return { body, headers: [...res.headers.entries()] }
    })
    return new Response(kept.body, { status: 200, headers: kept.headers })
  } catch (error) {
    if (!(error instanceof NotKept)) throw error
    // The caller that built it has the answer; one that shared its in-flight load builds its own.
    return built ?? build()
  }
}
