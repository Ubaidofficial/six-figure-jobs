import { NextResponse } from 'next/server'
import { getCitySitemapUrls } from '../../lib/seo/citySitemap'

export const dynamic = 'force-dynamic'
export const revalidate = 43200

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  try {
    const urls = await getCitySitemapUrls()

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod)}</lastmod>
    <changefreq>${escapeXml(u.changefreq)}</changefreq>
    <priority>${escapeXml(String(u.priority))}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`

    return new NextResponse(xml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    })
  } catch (error) {
    // Explicit fallback marker so failures are observable in logs/monitoring.
    console.error('[sitemap-city] fallback_used=1 reason=builder_error', error)

    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><!-- fallback_used=1 --></urlset>`

    return new NextResponse(fallback, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Sitemap-Fallback': '1',
      },
    })
  }
}
