// app/sitemap.xml/route.ts
import { getSiteUrl } from '../../lib/seo/site'

const SITE_URL = getSiteUrl()
// Since this route is force-static, this timestamp effectively becomes the build-time lastmod.
const BUILD_LASTMOD = new Date().toISOString()

export const dynamic = 'force-static'
// Optional: keep sitemaps reasonably fresh without being regenerated constantly
export const revalidate = 60 * 60 * 24 // 24h

export async function GET() {
  const sitemaps = [
    'sitemap-jobs.xml',
    'sitemap-company.xml',
    'sitemap-remote.xml',
    'sitemap-salary.xml',
    'sitemap-country.xml',
    'sitemap-category.xml',
    'sitemap-level.xml',
    'sitemap-browse.xml',
    'sitemap-slices.xml',
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (s) => `  <sitemap>
    <loc>${SITE_URL}/${s}</loc>
    <lastmod>${BUILD_LASTMOD}</lastmod>
  </sitemap>`
  )
  .join('\n')}
</sitemapindex>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
