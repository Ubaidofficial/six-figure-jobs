import { prisma } from '../../lib/prisma'
import { buildWhere } from '../../lib/jobs/queryJobs'

const SITE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://www.6figjobs.com'

export async function GET() {
  const MIN_INDEXABLE_JOBS = 3
  const levels = ['entry', 'mid', 'senior', 'lead', 'executive']
  const baseWhere = buildWhere({})

  const rows = await prisma.job.groupBy({
    by: ['experienceLevel'],
    where: { ...baseWhere, experienceLevel: { in: levels } },
    _count: { _all: true },
  })

  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.experienceLevel) continue
    counts.set(String(row.experienceLevel).toLowerCase(), Number(row._count?._all ?? 0))
  }

  const urls = levels
    .map((level) => {
      const total = counts.get(level) ?? 0
      if (total < MIN_INDEXABLE_JOBS) return null
      return {
        url: `${SITE_URL}/jobs/level/${level}`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'daily',
        priority: 0.7,
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
