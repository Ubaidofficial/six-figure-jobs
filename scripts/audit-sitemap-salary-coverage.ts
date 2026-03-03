/**
 * Deep audit: sitemap job quality vs salary validation coverage.
 *
 * This matches current job sitemap eligibility:
 *   isExpired=false AND buildGlobalExclusionsWhere() AND buildHighSalaryEligibilityWhere()
 * The report also includes pre-gate coverage diagnostics.
 *
 * Usage:
 *   npx tsx scripts/audit-sitemap-salary-coverage.ts
 */

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { buildGlobalExclusionsWhere, buildHighSalaryEligibilityWhere } from '../lib/jobs/queryJobs'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()

const HIGH_CONFIDENCE_MIN = 80

function pct(part: number, total: number): string {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

function sortDescByCount<T extends { count: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.count - a.count)
}

async function main() {
  const baseWhere = {
    isExpired: false,
    AND: [buildGlobalExclusionsWhere()],
  } as const

  const sitemapWhere = {
    isExpired: false,
    AND: [buildGlobalExclusionsWhere(), buildHighSalaryEligibilityWhere()],
  } as const

  const validatedWhere = {
    ...baseWhere,
    salaryValidated: true,
  } as const

  const validatedHighConfidenceWhere = {
    ...baseWhere,
    salaryValidated: true,
    salaryConfidence: { gte: HIGH_CONFIDENCE_MIN },
  } as const

  const [
    totalActive,
    totalBase,
    totalInSitemap,
    validatedInBase,
    confidenceNullInBase,
    confidenceLt80InBase,
    confidenceNullValidatedInBase,
    confidenceLt80ValidatedInBase,
    validatedHighConfidenceInBase,
    validatedConfidenceAggBase,
    validatedConfidenceAggSitemap,
  ] = await Promise.all([
    prisma.job.count({ where: { isExpired: false } }),
    prisma.job.count({ where: baseWhere }),
    prisma.job.count({ where: sitemapWhere }),
    prisma.job.count({ where: validatedWhere }),
    prisma.job.count({ where: { ...baseWhere, salaryConfidence: null } }),
    prisma.job.count({ where: { ...baseWhere, salaryConfidence: { lt: HIGH_CONFIDENCE_MIN } } }),
    prisma.job.count({ where: { ...validatedWhere, salaryConfidence: null } }),
    prisma.job.count({ where: { ...validatedWhere, salaryConfidence: { lt: HIGH_CONFIDENCE_MIN } } }),
    prisma.job.count({ where: validatedHighConfidenceWhere }),
    prisma.job.aggregate({
      where: validatedWhere,
      _avg: { salaryConfidence: true },
      _min: { salaryConfidence: true },
      _max: { salaryConfidence: true },
    }),
    prisma.job.aggregate({
      where: sitemapWhere,
      _avg: { salaryConfidence: true },
      _min: { salaryConfidence: true },
      _max: { salaryConfidence: true },
    }),
  ])

  const nonValidatedInBase = totalBase - validatedInBase
  const excludedFromSitemap = totalBase - totalInSitemap

  __slog('**Active Jobs vs Sitemap Eligibility**')
  __slog(`- Active (isExpired=false): ${totalActive}`)
  __slog(`- Base (active + global exclusions): ${totalBase}`)
  __slog(
    `- Eligible for sitemap (high-salary gate): ${totalInSitemap} (${pct(
      totalInSitemap,
      totalBase,
    )})`,
  )
  __slog(
    `- Excluded by sitemap gate: ${excludedFromSitemap} (${pct(
      excludedFromSitemap,
      totalBase,
    )})`,
  )
  __slog('')

  __slog('**Base Pool Composition (pre-salary gate)**')
  __slog(`- Total: ${totalBase}`)
  __slog(`- Validated: ${validatedInBase} (${pct(validatedInBase, totalBase)})`)
  __slog(`- Non-validated: ${nonValidatedInBase} (${pct(nonValidatedInBase, totalBase)})`)
  __slog(
    `- salaryConfidence null: ${confidenceNullInBase} (${pct(
      confidenceNullInBase,
      totalBase,
    )})`,
  )
  __slog(
    `- salaryConfidence < ${HIGH_CONFIDENCE_MIN}: ${confidenceLt80InBase} (${pct(
      confidenceLt80InBase,
      totalBase,
    )})`,
  )
  __slog(
    `- Validated but confidence null: ${confidenceNullValidatedInBase} (${pct(
      confidenceNullValidatedInBase,
      validatedInBase,
    )})`,
  )
  __slog(
    `- Validated but confidence < ${HIGH_CONFIDENCE_MIN}: ${confidenceLt80ValidatedInBase} (${pct(
      confidenceLt80ValidatedInBase,
      validatedInBase,
    )})`,
  )
  __slog(
    `- Validated confidence avg/min/max: ${Math.round(
      Number(validatedConfidenceAggBase._avg.salaryConfidence ?? 0),
    )}/${validatedConfidenceAggBase._min.salaryConfidence ?? 'null'}/${validatedConfidenceAggBase._max.salaryConfidence ?? 'null'}`,
  )
  __slog('')

  __slog('**Sitemap Composition (high-salary eligible)**')
  __slog(`- Total: ${totalInSitemap}`)
  __slog(
    `- Eligible confidence avg/min/max: ${Math.round(
      Number(validatedConfidenceAggSitemap._avg.salaryConfidence ?? 0),
    )}/${validatedConfidenceAggSitemap._min.salaryConfidence ?? 'null'}/${validatedConfidenceAggSitemap._max.salaryConfidence ?? 'null'}`,
  )
  __slog('')

  const byValidatedAndReason = await prisma.job.groupBy({
    by: ['salaryValidated', 'salaryParseReason'],
    where: baseWhere,
    _count: { _all: true },
  })

  __slog('**Salary Parse Reason Breakdown (base pool)**')
  for (const row of sortDescByCount(
    byValidatedAndReason.map((r) => ({
      salaryValidated: r.salaryValidated,
      salaryParseReason: r.salaryParseReason ?? 'null',
      count: r._count._all,
    })),
  )) {
    __slog(
      `- salaryValidated=${row.salaryValidated} salaryParseReason=${row.salaryParseReason}: ${row.count} (${pct(
        row.count,
        totalBase,
      )})`,
    )
  }
  __slog('')

  const nonValidatedSources = await prisma.job.groupBy({
    by: ['source'],
    where: { ...baseWhere, salaryValidated: false },
    _count: { _all: true },
  })

  __slog('**Top Sources Contributing Non-Validated Jobs (base pool)**')
  for (const row of sortDescByCount(
    nonValidatedSources.map((r) => ({ source: r.source ?? 'null', count: r._count._all })),
  ).slice(0, 15)) {
    __slog(`- ${row.source}: ${row.count} (${pct(row.count, nonValidatedInBase)})`)
  }
  __slog('')

  // Impact analysis: salaryValidated=true filter (only)
  const removedByValidatedOnly = totalBase - validatedInBase

  __slog('**Impact of salaryValidated=true Filter**')
  __slog(`- Jobs removed: ${removedByValidatedOnly}`)
  __slog(`- Jobs remaining: ${validatedInBase}`)
  __slog('')

  const roleCountsAll = await prisma.job.groupBy({
    by: ['roleSlug'],
    where: baseWhere,
    _count: { _all: true },
  })
  const roleCountsValidated = await prisma.job.groupBy({
    by: ['roleSlug'],
    where: validatedWhere,
    _count: { _all: true },
  })

  const roleAllMap = new Map<string, number>()
  for (const r of roleCountsAll) roleAllMap.set(r.roleSlug ?? 'null', r._count._all)

  const roleValidatedMap = new Map<string, number>()
  for (const r of roleCountsValidated) roleValidatedMap.set(r.roleSlug ?? 'null', r._count._all)

  const roleRetention = Array.from(roleAllMap.entries()).map(([role, total]) => {
    const keep = roleValidatedMap.get(role) ?? 0
    const lost = total - keep
    const lostPct = total > 0 ? lost / total : 0
    return { role, total, keep, lost, lostPct }
  })

  const rolesLosingAllMajor = roleRetention.filter((r) => r.total >= 10 && r.keep === 0)
  const rolesLosingMoreThanHalfMajor = roleRetention.filter((r) => r.total >= 10 && r.lostPct >= 0.5)

  __slog(`- Roles losing all jobs (roles with >=10 jobs): ${rolesLosingAllMajor.length}`)
  __slog(
    `- Roles losing >50% (roles with >=10 jobs): ${rolesLosingMoreThanHalfMajor.length}`,
  )
  for (const r of [...rolesLosingAllMajor].sort((a, b) => b.total - a.total).slice(0, 25)) {
    __slog(`  - ${r.role}: total=${r.total} keep=${r.keep}`)
  }
  for (const r of [...rolesLosingMoreThanHalfMajor].sort((a, b) => b.lostPct - a.lostPct).slice(0, 25)) {
    __slog(`  - ${r.role}: total=${r.total} keep=${r.keep} lost=${pct(r.lost, r.total)}`)
  }
  __slog('')

  const companyCountsAll = await prisma.job.groupBy({
    by: ['companyId'],
    where: sitemapWhere,
    _count: { _all: true },
  })
  const companyCountsValidated = await prisma.job.groupBy({
    by: ['companyId'],
    where: validatedWhere,
    _count: { _all: true },
  })

  const companyAllMap = new Map<string, number>()
  for (const r of companyCountsAll) companyAllMap.set(r.companyId ?? 'null', r._count._all)

  const companyValidatedMap = new Map<string, number>()
  for (const r of companyCountsValidated) companyValidatedMap.set(r.companyId ?? 'null', r._count._all)

  let companiesLosingAll = 0
  for (const [companyId, total] of companyAllMap.entries()) {
    if (total <= 0) continue
    const keep = companyValidatedMap.get(companyId) ?? 0
    if (keep === 0) companiesLosingAll++
  }

  __slog(`- Companies losing all sitemap jobs: ${companiesLosingAll}`)
  __slog('')

  const [topCountriesSitemap, topRemoteModesSitemap, topRolesSitemap, topCompaniesSitemap] =
    await Promise.all([
      prisma.job.groupBy({
        by: ['countryCode'],
        where: sitemapWhere,
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ['remoteMode'],
        where: sitemapWhere,
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ['roleSlug'],
        where: sitemapWhere,
        _count: { _all: true },
      }),
      prisma.job.groupBy({
        by: ['company'],
        where: sitemapWhere,
        _count: { _all: true },
      }),
    ])

  __slog('**Quality Metrics for eligible high-salary jobs (sitemap scope)**')
  __slog('- Top countries:')
  for (const row of sortDescByCount(
    topCountriesSitemap.map((r) => ({ k: r.countryCode ?? 'null', count: r._count._all })),
  ).slice(0, 10)) {
    __slog(`  - ${row.k}: ${row.count} (${pct(row.count, totalInSitemap)})`)
  }
  __slog('- Remote modes:')
  for (const row of sortDescByCount(
    topRemoteModesSitemap.map((r) => ({ k: r.remoteMode ?? 'null', count: r._count._all })),
  ).slice(0, 10)) {
    __slog(`  - ${row.k}: ${row.count} (${pct(row.count, totalInSitemap)})`)
  }
  __slog('- Top roles:')
  for (const row of sortDescByCount(
    topRolesSitemap.map((r) => ({ k: r.roleSlug ?? 'null', count: r._count._all })),
  ).slice(0, 10)) {
    __slog(`  - ${row.k}: ${row.count} (${pct(row.count, totalInSitemap)})`)
  }
  __slog('- Top companies:')
  for (const row of sortDescByCount(
    topCompaniesSitemap.map((r) => ({ k: r.company ?? 'null', count: r._count._all })),
  ).slice(0, 10)) {
    __slog(`  - ${row.k}: ${row.count} (${pct(row.count, totalInSitemap)})`)
  }
  __slog('')

  // Alternative strategy sizing
  __slog('**Alternative Strategy Sizing**')
  __slog(
    `- salaryValidated=true AND confidence>=${HIGH_CONFIDENCE_MIN}: ${validatedHighConfidenceInBase} (${pct(
      validatedHighConfidenceInBase,
      totalBase,
    )})`,
  )
  __slog(
    `- Full site gate (buildHighSalaryEligibilityWhere): ${totalInSitemap} (${pct(
      totalInSitemap,
      totalBase,
    )})`,
  )
}

main()
  .catch((e) => {
    __serr(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
