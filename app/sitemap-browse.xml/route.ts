// app/sitemap-browse.xml/route.ts
// Sitemap for category + location browse pages (programmatic SEO)

import { NextResponse } from 'next/server'

import { buildBrowseSitemapReport } from '@/lib/seo/browseSitemap'
import { getSiteUrl } from '@/lib/seo/site'

const SITE_URL = getSiteUrl()

export const revalidate = 3600

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const report = await buildBrowseSitemapReport(3)
  const urls = report.included.map((row) => `${SITE_URL}${row.path}`)
  const uniqueUrls = Array.from(new Set(urls))

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u)}</loc>
    <changefreq>daily</changefreq>
  </url>`,
  )
  .join('\n')}
</urlset>`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
