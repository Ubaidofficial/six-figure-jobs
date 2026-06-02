import { SALARY_TIERS, type SalaryTierId } from '../jobs/salaryTiers'
import {
  buildWhere,
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
} from '../jobs/queryJobs'
import { buildFreshJobWhere, MAX_INDEXABLE_JOB_AGE_DAYS } from '../jobs/freshness'
import { buildIndexableJobStructureWhere } from '../jobs/qualityGate'
import { prisma } from '../prisma'
import { buildBrowseSitemapReport } from './browseSitemap'
import {
  isSalaryTierPageIndexable,
  MIN_COMPANY_INDEXABLE_JOBS,
} from './indexabilityGates'
import { JOB_CATEGORY_MAP } from './jobCategories'

type CoreFamilyKey = 'jobs' | 'company' | 'salary' | 'category' | 'level' | 'browse'

type CoreFamilyState = {
  hasJobUrls: boolean
  hasCompanyUrls: boolean
  hasSalaryUrls: boolean
  hasCategoryUrls: boolean
  hasLevelUrls: boolean
  hasBrowseUrls: boolean
  failedFamilies: CoreFamilyKey[]
}

const CATEGORY_MIN_INDEXABLE_JOBS = 1
const LEVEL_MIN_INDEXABLE_JOBS = 1
const LEVELS = ['entry', 'mid', 'senior', 'lead', 'executive'] as const

function resolveSettledValue<T>(
  routeTag: string,
  family: CoreFamilyKey,
  result: PromiseSettledResult<T>,
  fallbackValue: T,
): { value: T; failed: boolean } {
  if (result.status === 'fulfilled') {
    return { value: result.value, failed: false }
  }

  console.error(`[${routeTag}] fallback_used=1 core_family=${family}`, result.reason)

  return { value: fallbackValue, failed: true }
}

function buildJobSitemapWhere() {
  return {
    isExpired: false,
    AND: [
      buildGlobalExclusionsWhere(),
      buildHighSalaryEligibilityWhere(),
      buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS),
      buildIndexableJobStructureWhere(),
    ],
  }
}

export async function hasJobSitemapEntries(): Promise<boolean> {
  const row = await prisma.job.findFirst({
    where: buildJobSitemapWhere(),
    select: { id: true },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  })

  return Boolean(row)
}

export async function hasCompanySitemapEntries(): Promise<boolean> {
  const eligibleJobWhere = buildWhere({})
  const row = await prisma.job.findFirst({
    where: {
      ...eligibleJobWhere,
      companyId: { not: null },
    },
    select: { id: true },
  })

  return Boolean(row)
}

export async function hasSalarySitemapEntries(): Promise<boolean> {
  const counts = await Promise.all(
    (Object.keys(SALARY_TIERS) as SalaryTierId[]).map(async (tierId) => {
      const tier = SALARY_TIERS[tierId]
      const where = buildWhere({
        currency: 'USD',
        minAnnual: tier.minAnnualUsd,
        ...(tier.maxAnnualUsd ? { maxAnnual: tier.maxAnnualUsd } : {}),
      } as any)

      return prisma.job.count({ where })
    }),
  )

  return counts.some((count) => isSalaryTierPageIndexable(count))
}

export async function hasCategorySitemapEntries(): Promise<boolean> {
  const baseWhere = buildWhere({})
  const roleRows = await prisma.job.findMany({
    where: { ...baseWhere, roleSlug: { not: null } },
    select: { roleSlug: true },
    distinct: ['roleSlug'],
  })

  const roleStats = roleRows
    .map((row) => ({
      slug: row.roleSlug ? String(row.roleSlug).toLowerCase() : '',
      count: 1,
    }))
    .filter((row) => row.slug)

  return Object.keys(JOB_CATEGORY_MAP).some((category) => {
    const slugs = (JOB_CATEGORY_MAP[category]?.roleSlugs || []).map((value) => value.toLowerCase())
    let total = 0

    for (const row of roleStats) {
      if (slugs.some((slug) => row.slug === slug || row.slug.includes(slug))) {
        total += row.count
      }
    }

    return total >= CATEGORY_MIN_INDEXABLE_JOBS
  })
}

export async function hasLevelSitemapEntries(): Promise<boolean> {
  const baseWhere = buildWhere({})
  const row = await prisma.job.findFirst({
    where: { ...baseWhere, experienceLevel: { in: [...LEVELS] } },
    select: { id: true },
  })

  return Boolean(row)
}

export async function hasBrowseSitemapEntries(): Promise<boolean> {
  const report = await buildBrowseSitemapReport(3)
  return report.included.length > 0
}

export async function resolveCoreSitemapFamilies(
  routeTag: string,
): Promise<CoreFamilyState> {
  const [
    jobsResult,
    companyResult,
    salaryResult,
    categoryResult,
    levelResult,
    browseResult,
  ] = await Promise.allSettled([
    hasJobSitemapEntries(),
    hasCompanySitemapEntries(),
    hasSalarySitemapEntries(),
    hasCategorySitemapEntries(),
    hasLevelSitemapEntries(),
    hasBrowseSitemapEntries(),
  ])

  const jobs = resolveSettledValue(routeTag, 'jobs', jobsResult, false)
  const company = resolveSettledValue(routeTag, 'company', companyResult, false)
  const salary = resolveSettledValue(routeTag, 'salary', salaryResult, false)
  const category = resolveSettledValue(routeTag, 'category', categoryResult, false)
  const level = resolveSettledValue(routeTag, 'level', levelResult, false)
  const browse = resolveSettledValue(routeTag, 'browse', browseResult, false)

  return {
    hasJobUrls: jobs.value,
    hasCompanyUrls: company.value,
    hasSalaryUrls: salary.value,
    hasCategoryUrls: category.value,
    hasLevelUrls: level.value,
    hasBrowseUrls: browse.value,
    failedFamilies: [
      ...(jobs.failed ? ['jobs' as const] : []),
      ...(company.failed ? ['company' as const] : []),
      ...(salary.failed ? ['salary' as const] : []),
      ...(category.failed ? ['category' as const] : []),
      ...(level.failed ? ['level' as const] : []),
      ...(browse.failed ? ['browse' as const] : []),
    ],
  }
}
