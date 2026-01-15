import { prisma } from '../../lib/prisma'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { countryCodeToSlug } from '../../lib/seo/countrySlug'

const SITE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://www.6figjobs.com'

export async function GET() {
  const MIN_INDEXABLE_JOBS = 3
  const countries = ['us', 'gb', 'ca', 'de', 'au', 'fr', 'nl', 'se']
  const countryCodes = countries.map((code) => code.toUpperCase())

  const baseWhere = buildWhere({})
  const rows = await prisma.job.groupBy({
    by: ['countryCode'],
    where: { ...baseWhere, countryCode: { in: countryCodes } },
    _count: { _all: true },
  })

  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.countryCode) continue
    counts.set(row.countryCode.toUpperCase(), Number(row._count?._all ?? 0))
  }

  const urls = countries
    .map((code) => {
      const total = counts.get(code.toUpperCase()) ?? 0
      if (total < MIN_INDEXABLE_JOBS) return null
      const slug = countryCodeToSlug(code)
      return {
        url: `${SITE_URL}/jobs/country/${slug}`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'daily',
        priority: 0.8,
      }
    })
    .filter(Boolean) as Array<{
      url: string
      lastModified: string
      changeFrequency: string
      priority: number
    }>

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
