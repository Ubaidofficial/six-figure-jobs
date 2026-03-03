// lib/salary/aggregates.ts
// v2.9: Data-layer helpers for salary analytics (no public pages yet).

import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { HIGH_SALARY_MIN_CONFIDENCE } from '../jobs/queryJobs'

export type SalaryAggregateFilter = {
  roleSlug?: string
  countryCode?: string
  citySlug?: string
  remoteOnly?: boolean
  remoteRegion?: string
}

export type SalaryAggregateInput = {
  sliceType: string
  sliceSlug: string
  currency: string
  minConfidence?: number
  filter?: SalaryAggregateFilter
}

export async function recomputeSalaryAggregate(input: SalaryAggregateInput) {
  const minConfidence = input.minConfidence ?? HIGH_SALARY_MIN_CONFIDENCE
  const currency = input.currency.toUpperCase()

  const clauses: Prisma.Sql[] = [
    Prisma.sql`"isExpired" = false`,
    Prisma.sql`"salaryValidated" = true`,
    Prisma.sql`"salaryConfidence" >= ${minConfidence}`,
    Prisma.sql`"currency" = ${currency}`,
    Prisma.sql`COALESCE("maxAnnual","minAnnual") IS NOT NULL`,
  ]

  const f = input.filter
  if (f?.roleSlug) clauses.push(Prisma.sql`"roleSlug" = ${f.roleSlug}`)
  if (f?.countryCode) clauses.push(Prisma.sql`"countryCode" = ${f.countryCode.toUpperCase()}`)
  if (f?.citySlug) clauses.push(Prisma.sql`"citySlug" = ${f.citySlug}`)
  if (f?.remoteRegion) clauses.push(Prisma.sql`"remoteRegion" = ${f.remoteRegion}`)
  if (f?.remoteOnly) {
    clauses.push(Prisma.sql`("remote" = true OR "remoteMode" = 'remote')`)
  }

  const whereSql = Prisma.join(clauses, ' AND ')

  const rows = await prisma.$queryRaw<
    Array<{
      jobCount: bigint
      minAnnual: bigint | null
      maxAnnual: bigint | null
      avgAnnual: bigint | null
      medianAnnual: bigint | null
      p75Annual: bigint | null
    }>
  >(Prisma.sql`
    WITH eligible AS (
      SELECT COALESCE("maxAnnual","minAnnual") AS annual
      FROM "Job"
      WHERE ${whereSql}
    )
    SELECT
      COUNT(*)::bigint AS "jobCount",
      MIN(annual) AS "minAnnual",
      MAX(annual) AS "maxAnnual",
      CAST(AVG(annual) AS bigint) AS "avgAnnual",
      CAST(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual) AS bigint) AS "medianAnnual",
      CAST(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY annual) AS bigint) AS "p75Annual"
    FROM eligible;
  `)

  const stats = rows?.[0]
  const jobCount = stats?.jobCount != null ? Number(stats.jobCount) : 0

  return prisma.salaryAggregate.upsert({
    where: {
      slice_currency_unique: {
        sliceType: input.sliceType,
        sliceSlug: input.sliceSlug,
        currency,
      },
    },
    create: {
      sliceType: input.sliceType,
      sliceSlug: input.sliceSlug,
      currency,
      minConfidence,
      jobCount,
      minAnnual: stats?.minAnnual ?? null,
      maxAnnual: stats?.maxAnnual ?? null,
      avgAnnual: stats?.avgAnnual ?? null,
      medianAnnual: stats?.medianAnnual ?? null,
      p75Annual: stats?.p75Annual ?? null,
      computedAt: new Date(),
    },
    update: {
      minConfidence,
      jobCount,
      minAnnual: stats?.minAnnual ?? null,
      maxAnnual: stats?.maxAnnual ?? null,
      avgAnnual: stats?.avgAnnual ?? null,
      medianAnnual: stats?.medianAnnual ?? null,
      p75Annual: stats?.p75Annual ?? null,
      computedAt: new Date(),
    },
  })
}

