import { NextResponse } from 'next/server'
import { getSiteUrl } from '../../lib/seo/site'
import { CITY_TARGETS } from '../../lib/seo/pseoTargets'

export const dynamic = 'force-dynamic'
export const revalidate = 86400

const SITE_URL = getSiteUrl()

export async function GET() {
  const urls = CITY_TARGETS.map((city) => ({
    loc: `${SITE_URL}/jobs/city/${city.slug}`,
    lastmod: new Date().toISOString(),
    changefreq: 'daily',
    priority: 0.8,
  }))

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
