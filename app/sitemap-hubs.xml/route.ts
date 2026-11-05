// app/sitemap-hubs.xml/route.ts
// Pillar hubs plus the evergreen pages that are indexable in the current phase (role pages, salary guides,
// remote role pages, blog). Entries come from lib/seo/evergreenSitemap.ts, which applies each page's own
// indexability rule, so this file never advertises a noindex page.
//
// Computed at request time (not prerendered): the deploy-time build cannot reach the database, and a build-time
// result would freeze a pillars-only sitemap.

import { getSiteUrl } from '../../lib/seo/site'
import { collectEvergreenEntries } from '../../lib/seo/evergreenSitemap'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const entries = await collectEvergreenEntries()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => {
    const loc = escapeXml(`${SITE_URL}${e.path === '/' ? '' : e.path}`)
    const lastmod = e.lastmod ? `\n    <lastmod>${e.lastmod.toISOString()}</lastmod>` : ''
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
