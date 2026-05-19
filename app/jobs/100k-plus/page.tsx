import type { Metadata } from 'next'

import { queryJobs } from '@/lib/jobs/queryJobs'
import { buildRuntimeFallbackMetadata, withRuntimeFallback } from '@/lib/runtime/fallback'
import { SALARY_TIERS } from '@/lib/jobs/salaryTiers'
import { buildNormalizedListingPath, hasNonPaginationQueryParams } from '@/lib/seo/listingSearchParams'
import { isSalaryTierPageIndexable } from '@/lib/seo/indexabilityGates'
import { SITE_NAME } from '@/lib/seo/site'

import { SalaryTierTemplate, buildSalaryTierMetadata } from '../_components/SalaryTierTemplate'

export const revalidate = 600

type SearchParams = Record<string, string | string[] | undefined>

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = (await searchParams) || {}
  const tier = SALARY_TIERS['100k-plus']
  const canonicalPath = buildNormalizedListingPath('/jobs/100k-plus', sp)
  return withRuntimeFallback<Metadata>(
    'jobs.100k-plus.metadata',
    async () => {
      const { total } = await queryJobs({
        page: 1,
        pageSize: 1,
        currency: 'USD',
        minAnnual: tier.minAnnualUsd,
        ...(tier.maxAnnualUsd ? { maxAnnual: tier.maxAnnualUsd } : {}),
      })
      const noindexUtilityState = hasNonPaginationQueryParams(sp)

      return {
        ...buildSalaryTierMetadata('100k-plus', total, { canonicalPath }),
        robots:
          !noindexUtilityState && isSalaryTierPageIndexable(total)
            ? { index: true, follow: true }
            : { index: false, follow: true },
      }
    },
    () =>
      buildRuntimeFallbackMetadata({
        canonicalPath,
        title: `Top ${tier.rangeLabel} Jobs | ${SITE_NAME}`,
        description:
          'The live salary-tier feed is temporarily unavailable while the production database reconnects.',
      }),
  )
}

export default function Jobs100kPlusPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  return <SalaryTierTemplate tierId="100k-plus" searchParams={searchParams} />
}
