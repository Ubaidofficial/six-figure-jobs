import type { Metadata } from 'next'

import { queryJobs } from '@/lib/jobs/queryJobs'
import { SALARY_TIERS } from '@/lib/jobs/salaryTiers'

import { SalaryTierTemplate, buildSalaryTierMetadata } from '../_components/SalaryTierTemplate'

export const dynamic = 'force-dynamic'
export const revalidate = 600

type SearchParams = Record<string, string | string[] | undefined>

export async function generateMetadata(): Promise<Metadata> {
  const tier = SALARY_TIERS['200k-plus']
  const { total } = await queryJobs({
    page: 1,
    pageSize: 1,
    currency: 'USD',
    minAnnual: tier.minAnnualUsd,
    ...(tier.maxAnnualUsd ? { maxAnnual: tier.maxAnnualUsd } : {}),
  })

  return buildSalaryTierMetadata('200k-plus', total)
}

export default function Jobs200kPlusPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  return <SalaryTierTemplate tierId="200k-plus" searchParams={searchParams} />
}

