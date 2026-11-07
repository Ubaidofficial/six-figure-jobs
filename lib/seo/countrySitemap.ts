import { buildWhere } from '../jobs/queryJobs'
import { prisma } from '../prisma'
import { countryCodeToSlug } from './countrySlug'
import { isCountryPageIndexable } from './indexabilityGates'
import { getSiteUrl } from './site'

const SITE_URL = getSiteUrl()
import { PHASE_1_COUNTRY_CODES, isPhase1 } from './indexingPhase'

const ALL_COUNTRY_CODES = ['US', 'GB', 'CA', 'DE', 'AU', 'FR', 'NL', 'SE']

/** In phase 1 only the allowlisted countries are listed (the page itself is noindex for the others). */
function countryCodes(): string[] {
  return isPhase1() ? ALL_COUNTRY_CODES.filter((c) => PHASE_1_COUNTRY_CODES.has(c)) : ALL_COUNTRY_CODES
}

export type CountrySitemapUrl = {
  url: string
  lastModified: string
}

export async function getCountrySitemapUrls(): Promise<CountrySitemapUrl[]> {
  const urls = (
    await Promise.all(
      countryCodes().map(async (countryCode) => {
        const where = buildWhere({
          countryCode,
          isHundredKLocal: true,
          page: 1,
          pageSize: 1,
        })

        const agg = await prisma.job.aggregate({
          where,
          _count: { _all: true },
          _max: { createdAt: true },
        })

        const total = Number(agg._count?._all ?? 0)
        if (!isCountryPageIndexable(total)) return null

        const slug = countryCodeToSlug(countryCode)
        const lastmod = (agg._max.createdAt ?? new Date()).toISOString()
        return {
          url: `${SITE_URL}/jobs/location/${slug}`,
          lastModified: lastmod,
        }
      }),
    )
  ).filter(Boolean) as CountrySitemapUrl[]

  return urls
}

export async function hasCountrySitemapEntries(): Promise<boolean> {
  for (const countryCode of countryCodes()) {
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
