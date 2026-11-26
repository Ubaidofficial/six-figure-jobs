// app/sitemap-hubs.xml/route.ts
// Pillar hubs plus the evergreen pages that are indexable in the current phase (role pages, salary guides,
// remote role pages, blog). Entries come from lib/seo/evergreenSitemap.ts, which applies each page's own
// indexability rule, so this file never advertises a noindex page.
//
// Computed at request time (not prerendered): the deploy-time build cannot reach the database, and a build-time
// result would freeze a pillars-only sitemap.

import { memoAsync } from '../../lib/cache/memo'
import { getSiteUrl } from '../../lib/seo/site'
import { collectEvergreenEntriesWithStatus, type SitemapEntry } from '../../lib/seo/evergreenSitemap'
import { sitemapDate } from '../../lib/seo/lastmod'
import { isHubPathInWave } from '../../lib/seo/sitemapWaves'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'

// The evergreen checks take about 14 s (2026-11-10); the entries are kept in memory for 30 minutes and served
// stale while they refresh (memoAsync), so a crawler never waits for them.
const ENTRIES_TTL_MS = 30 * 60 * 1000

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// An incomplete list (the database failed part-way) is never stored: the loader throws, so the memo keeps serving the last
// complete list while it retries, and only a request with no complete list yet gets the partial one. Before 2026-11-26 the
// partial list was cached for 30 minutes at a time, and with the database failing repeatedly the sitemap lost every role
// page, salary guide and /high-paying-jobs (19 URLs instead of the usual 40 or so).
class IncompleteEntriesError extends Error {
  constructor(readonly partial: SitemapEntry[]) {
    super('sitemap-hubs: database read incomplete')
  }
}

async function loadCompleteEntries(): Promise<SitemapEntry[]> {
  const { entries, complete } = await collectEvergreenEntriesWithStatus()
  if (!complete) throw new IncompleteEntriesError(entries)
  return entries
}

async function readEntries(): Promise<SitemapEntry[]> {
  try {
    return await memoAsync('sitemap-hubs', ENTRIES_TTL_MS, loadCompleteEntries)
  } catch (err) {
    if (err instanceof IncompleteEntriesError) return err.partial
    throw err
  }
}

export async function GET() {
  // The cached list holds every eligible page; the sitemap wave (lib/seo/sitemapWaves.ts) picks the ones submitted now,
  // so raising SITEMAP_WAVE takes effect on the next request without waiting for the cache.
  const entries = (await readEntries()).filter((e) => isHubPathInWave(e.path))

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => {
    const loc = escapeXml(`${SITE_URL}${e.path === '/' ? '' : e.path}`)
    const day = sitemapDate(e.lastmod)
    const lastmod = day ? `\n    <lastmod>${day}</lastmod>` : ''
    return `  <url>\n    <loc>${loc}</loc>${lastmod}\n  </url>`
  })
  .join('\n')}
  ${buildSitemapMetaComment('sitemap-hubs')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      ...buildSitemapMetaHeaders('sitemap-hubs'),
    },
  })
}
