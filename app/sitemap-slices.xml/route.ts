// app/sitemap-slices.xml/route.ts
// Sitemap index for slice shards (priority + longtail)

import { getSiteUrl } from '../../lib/seo/site'

const SITE_URL = getSiteUrl()

export const revalidate = 1800

export async function GET() {
  const entries = [
    'sitemap-slices/priority',
    'sitemap-slices/longtail',
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (loc) => `  <sitemap>
    <loc>${SITE_URL}/${loc}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>`

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
