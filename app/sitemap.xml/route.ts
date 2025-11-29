const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sixfigurejobs.com'

export async function GET() {
  const sitemaps = [
    'sitemap-jobs.xml',
    'sitemap-company.xml',
    'sitemap-remote.xml',
    'sitemap-salary.xml',
    'sitemap-country.xml',
    'sitemap-category.xml',
    'sitemap-level.xml',
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(s => `  <sitemap>
    <loc>${SITE_URL}/${s}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}