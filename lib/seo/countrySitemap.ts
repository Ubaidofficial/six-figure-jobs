import { buildWhere } from '../jobs/queryJobs'
import { prisma } from '../prisma'
import { countryCodeToSlug } from './countrySlug'
import { isCountryPageIndexable } from './indexabilityGates'
import { getSiteUrl } from './site'

const SITE_URL = getSiteUrl()
const COUNTRY_CODES = ['US', 'GB', 'CA', 'DE', 'AU', 'FR', 'NL', 'SE']

export type CountrySitemapUrl = {
  url: string
  lastModified: string
  changeFrequency: string
  priority: number
}

export async function getCountrySitemapUrls(): Promise<CountrySitemapUrl[]> {
  const urls = (
    await Promise.all(
      COUNTRY_CODES.map(async (countryCode) => {
        const where = buildWhere({
          countryCode,
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
        if (!isCountryPageIndexable(total)) return null

        const slug = countryCodeToSlug(countryCode)
        const lastmod = (agg._max.updatedAt ?? new Date()).toISOString()
        return {
          url: `${SITE_URL}/jobs/location/${slug}`,
          lastModified: lastmod,
          changeFrequency: 'daily',
          priority: 0.8,
        }
      }),
    )
  ).filter(Boolean) as CountrySitemapUrl[]

  return urls
}

export async function hasCountrySitemapEntries(): Promise<boolean> {
  for (const countryCode of COUNTRY_CODES) {
    const where = buildWhere({
      countryCode,
      isHundredKLocal: true,
      page: 1,
      pageSize: 1,
    })
    const total = await prisma.job.count({ where })
    if (isCountryPageIndexable(total)) return true
  }

  return false
}
