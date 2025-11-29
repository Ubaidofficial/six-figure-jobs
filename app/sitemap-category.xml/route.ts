const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sixfigurejobs.com'

export async function GET() {
  const categories = ['engineering', 'product', 'design', 'data', 'marketing', 'sales', 'devops', 'ai-ml']

  const urls = categories.map(cat => ({
    url: `${SITE_URL}/jobs/category/${cat}`,
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