import { NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { getSiteUrl } from '../../lib/seo/site'
import { CITY_TARGETS } from '../../lib/seo/pseoTargets'

export const dynamic = 'force-dynamic'
export const revalidate = 43200

const SITE_URL = getSiteUrl()
const MIN_INDEXABLE_JOBS = 3

export async function GET() {
  const baseWhere = buildWhere({})
  const citySlugs = CITY_TARGETS.map((city) => city.slug)
  const countryCodes = CITY_TARGETS.map((city) => city.countryCode)
    .filter(Boolean)
    .map((code) => String(code).toUpperCase())

  const rows = await prisma.job.groupBy({
    by: ['citySlug', 'countryCode'],
    where: {
      ...baseWhere,
      citySlug: { in: citySlugs },
      countryCode: { in: countryCodes },
    },
    _count: { _all: true },
  })

  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = `${row.citySlug ?? ''}::${row.countryCode ?? ''}`.toLowerCase()
    counts.set(key, Number(row._count?._all ?? 0))
  }

  const urls = CITY_TARGETS.map((city) => {
    const key = `${city.slug}::${String(city.countryCode || '').toUpperCase()}`.toLowerCase()
    const total = counts.get(key) ?? 0
    if (total < MIN_INDEXABLE_JOBS) return null

    return {
      loc: `${SITE_URL}/jobs/city/${city.slug}`,
      lastmod: new Date().toISOString(),
      changefreq: 'daily',
      priority: 0.8,
    }
  }).filter(Boolean) as Array<{
    loc: string
    lastmod: string
    changefreq: string
    priority: number
  }>

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
