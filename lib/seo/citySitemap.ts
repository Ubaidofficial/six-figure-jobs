import { prisma } from '../prisma'
import { buildWhere } from '../jobs/queryJobs'
import { getSiteUrl } from './site'
import { CITY_TARGETS } from './pseoTargets'
import { isCityPageIndexable } from './indexabilityGates'

const SITE_URL = getSiteUrl()

export async function getCitySitemapUrls() {
  const rows = await Promise.all(
    CITY_TARGETS.map(async (city) => {
      // Keep sitemap inclusion aligned with page robots logic:
      // use the same queryJobs filter shape (city + country + local threshold mode).
      const where = buildWhere({
        citySlug: city.slug,
        countryCode: city.countryCode,
        isHundredKLocal: true,
        page: 1,
        pageSize: 1,
      })

      const agg = await prisma.job.aggregate({
        where,
        _count: { _all: true },
        _max: { updatedAt: true },
      })

      const total = Number(agg._count?._all ?? 0)
      if (!isCityPageIndexable(total)) return null

      return {
        loc: `${SITE_URL}/jobs/city/${city.slug}`,
        lastmod: (agg._max.updatedAt ?? new Date()).toISOString(),
      }
    }),
  )

  return rows.filter(Boolean) as Array<{
    loc: string
    lastmod: string
  }>
}
