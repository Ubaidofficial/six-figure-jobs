// app/sitemap-browse.xml/route.ts
// Sitemap for category + location browse pages (programmatic SEO)

import { NextResponse } from 'next/server'
import { CATEGORY_LINKS, LOCATIONS } from '../page'

export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

export async function GET() {
  const urls: string[] = []

  CATEGORY_LINKS.forEach((cat) => {
    urls.push(`${SITE_URL}${cat.href}`)
  })

  LOCATIONS.forEach((loc) => {
    urls.push(
      loc.code === 'remote'
        ? `${SITE_URL}/jobs/location/remote`
        : `${SITE_URL}/jobs/location/${loc.code}`,
    )
  })

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u}</loc>
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
