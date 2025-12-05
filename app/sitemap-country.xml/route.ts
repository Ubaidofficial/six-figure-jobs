import { getSiteUrl } from '../../lib/seo/site'

const SITE_URL = getSiteUrl()

export async function GET() {
  const countries = ['us', 'gb', 'ca', 'de', 'au', 'fr', 'nl', 'se']

  const urls = countries.map(code => ({
    url: `${SITE_URL}/jobs/country/${code}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.url}</loc>
    <lastmod>${u.lastModified}</lastmod>
    <changefreq>${u.changeFrequency}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
