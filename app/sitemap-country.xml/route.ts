import { prisma } from '../../lib/prisma'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { countryCodeToSlug } from '../../lib/seo/countrySlug'
import { getSiteUrl } from '../../lib/seo/site'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'

export async function GET() {
  const MIN_INDEXABLE_JOBS = 3
  const countries = ['us', 'gb', 'ca', 'de', 'au', 'fr', 'nl', 'se']
  const countryCodes = countries.map((code) => code.toUpperCase())

  const baseWhere = buildWhere({})
  const rows = await prisma.job.groupBy({
    by: ['countryCode'],
    where: { ...baseWhere, countryCode: { in: countryCodes } },
    _count: { _all: true },
    _max: { updatedAt: true },
  })

  const counts = new Map<string, number>()
  const lastmods = new Map<string, Date>()
  for (const row of rows) {
    if (!row.countryCode) continue
    counts.set(row.countryCode.toUpperCase(), Number(row._count?._all ?? 0))
    const updatedAt = row._max?.updatedAt ?? null
    if (updatedAt) lastmods.set(row.countryCode.toUpperCase(), updatedAt)
  }

  const urls = countries
    .map((code) => {
      const total = counts.get(code.toUpperCase()) ?? 0
      if (total < MIN_INDEXABLE_JOBS) return null
      const slug = countryCodeToSlug(code)
      const lastmod = (lastmods.get(code.toUpperCase()) ?? new Date()).toISOString()
      return {
        url: `${SITE_URL}/jobs/country/${slug}`,
        lastModified: lastmod,
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
