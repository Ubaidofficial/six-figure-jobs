import { prisma } from '../prisma'
import { buildWhere } from '../jobs/queryJobs'
import { getSiteUrl } from './site'
import { CITY_TARGETS } from './pseoTargets'

const SITE_URL = getSiteUrl()
const MIN_INDEXABLE_JOBS = 3

export async function getCitySitemapUrls() {
  const baseWhere = buildWhere({})
  const citySlugs = CITY_TARGETS.map((city) => city.slug)

  // City routes are slug-only; countryCode is often missing, so group by citySlug.
  const rows = await prisma.job.groupBy({
    by: ['citySlug'],
    where: {
      ...baseWhere,
      citySlug: { in: citySlugs },
    },
    _count: { _all: true },
    _max: { updatedAt: true },
  })

  const counts = new Map<string, number>()
  const lastmods = new Map<string, Date>()
  for (const row of rows) {
    const key = String(row.citySlug ?? '').toLowerCase()
    if (!key) continue
    counts.set(key, Number(row._count?._all ?? 0))
    const updatedAt = row._max?.updatedAt ?? null
    if (updatedAt) lastmods.set(key, updatedAt)
  }

  return CITY_TARGETS.map((city) => {
    const key = city.slug.toLowerCase()
    const total = counts.get(key) ?? 0
    if (total < MIN_INDEXABLE_JOBS) return null

    const lastmod = (lastmods.get(key) ?? new Date()).toISOString()
    return {
      loc: `${SITE_URL}/jobs/city/${city.slug}`,
      lastmod,
      changefreq: 'daily',
      priority: 0.8,
    }
  }).filter(Boolean) as Array<{
    loc: string
    lastmod: string
    changefreq: string
    priority: number
  }>
}
