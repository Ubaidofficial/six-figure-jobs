import type { Metadata } from 'next'

import { queryJobs } from '@/lib/jobs/queryJobs'
import { SALARY_TIERS } from '@/lib/jobs/salaryTiers'

import { SalaryTierTemplate, buildSalaryTierMetadata } from '../_components/SalaryTierTemplate'

export const dynamic = 'force-dynamic'
export const revalidate = 600

type SearchParams = Record<string, string | string[] | undefined>

export async function generateMetadata(): Promise<Metadata> {
  const tier = SALARY_TIERS['400k-plus']
  const { total } = await queryJobs({
    page: 1,
    pageSize: 1,
    currency: 'USD',
    minAnnual: tier.minAnnualUsd,
  })

  return buildSalaryTierMetadata('400k-plus', total)
}

export default function Jobs400kPlusPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  return <SalaryTierTemplate tierId="400k-plus" searchParams={searchParams} />
}

