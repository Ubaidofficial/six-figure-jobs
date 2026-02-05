import { prisma } from '../../lib/prisma'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { buildSliceCanonicalPath } from '../../lib/seo/canonical'
import { getSiteUrl } from '../../lib/seo/site'

const SITE_URL = getSiteUrl()

export async function GET() {
  const tiers: Array<{ slug: string; min: number; max?: number | null }> = [
    { slug: '100k-plus', min: 100_000, max: 199_999 },
    { slug: '200k-plus', min: 200_000, max: 299_999 },
    { slug: '300k-plus', min: 300_000, max: 399_999 },
    { slug: '400k-plus', min: 400_000, max: null },
  ]

  const urls = await Promise.all(tiers.map(async (tier) => {
    const path = buildSliceCanonicalPath({
      minAnnual: tier.min,
    } as any)

    const where = buildWhere({
      currency: 'USD',
      minAnnual: tier.min,
      ...(tier.max ? { maxAnnual: tier.max } : {}),
    } as any)

    const agg = await prisma.job.aggregate({
      where,
      _max: { updatedAt: true },
    })

    return {
      url: `${SITE_URL}${path}`,
      lastModified: (agg._max.updatedAt ?? new Date()).toISOString(),
      changeFrequency: 'daily',
      priority: 0.9,
    }
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
