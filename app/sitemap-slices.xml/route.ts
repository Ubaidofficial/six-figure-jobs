// app/sitemap-slices.xml/route.ts
// Sitemap index for slice shards (priority + longtail)

const SITE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://www.6figjobs.com'

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
