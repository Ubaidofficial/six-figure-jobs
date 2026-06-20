// app/sitemap-hubs.xml/route.ts
// Core navigational hubs — always indexable, always in sitemap.
// These pages are NOT in any other sitemap family; without this file
// Google has no sitemap path to discover /salary, /companies, /remote, /jobs.

import { getSiteUrl } from '../../lib/seo/site'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

const SITE_URL = getSiteUrl()

export const revalidate = 86400 // 24h

const HUB_PATHS = ['/', '/jobs', '/salary', '/companies', '/remote']

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${HUB_PATHS.map((p) => `  <url>\n    <loc>${SITE_URL}${p === '/' ? '' : p}</loc>\n  </url>`).join('\n')}
  ${buildSitemapMetaComment('sitemap-hubs')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...buildSitemapMetaHeaders('sitemap-hubs'),
    },
  })
}
