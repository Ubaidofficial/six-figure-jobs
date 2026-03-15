import type { Metadata } from 'next'

import { queryJobs } from '@/lib/jobs/queryJobs'
import { SALARY_TIERS } from '@/lib/jobs/salaryTiers'
import { buildNormalizedListingPath, hasNonPaginationQueryParams } from '@/lib/seo/listingSearchParams'
import { isSalaryTierPageIndexable } from '@/lib/seo/indexabilityGates'

import { SalaryTierTemplate, buildSalaryTierMetadata } from '../_components/SalaryTierTemplate'

export const dynamic = 'force-dynamic'
export const revalidate = 600

type SearchParams = Record<string, string | string[] | undefined>

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}): Promise<Metadata> {
  const sp = (await searchParams) || {}
  const tier = SALARY_TIERS['400k-plus']
  const { total } = await queryJobs({
    page: 1,
    pageSize: 1,
    currency: 'USD',
    minAnnual: tier.minAnnualUsd,
  })

  const canonicalPath = buildNormalizedListingPath('/jobs/400k-plus', sp)
  const noindexUtilityState = hasNonPaginationQueryParams(sp)

  return {
    ...buildSalaryTierMetadata('400k-plus', total, { canonicalPath }),
    robots:
      !noindexUtilityState && isSalaryTierPageIndexable(total)
        ? { index: true, follow: true }
        : { index: false, follow: true },
  }
}

export default function Jobs400kPlusPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  return <SalaryTierTemplate tierId="400k-plus" searchParams={searchParams} />
}
