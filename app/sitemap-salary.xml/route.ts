import { buildSliceCanonicalPath } from '../../lib/seo/canonical'

const SITE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://www.6figjobs.com'

export async function GET() {
  const tiers: Array<{ slug: string; min: number }> = [
    { slug: '100k-plus', min: 100_000 },
    { slug: '200k-plus', min: 200_000 },
    { slug: '300k-plus', min: 300_000 },
    { slug: '400k-plus', min: 400_000 },
  ]

  const urls = tiers.map((tier) => {
    const path = buildSliceCanonicalPath({
      minAnnual: tier.min,
      isHundredKLocal: true,
    } as any)

    return {
      url: `${SITE_URL}${path}`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'daily',
      priority: 0.9,
    }
  })

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
