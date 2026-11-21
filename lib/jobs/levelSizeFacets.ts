// lib/jobs/levelSizeFacets.ts
//
// How many jobs each Seniority and Company size option of the listing filter would show, with the page's other filters
// applied (a group's own choice is left out, so picking "Senior" still shows how many "Staff" jobs there are). The
// options had no counts, so a visitor could pick one that leaves nothing. Seniority is Job.experienceLevel (read from the
// title at ingest), counted in one query; company size is on the company (see companySizeCounts).
import { prisma } from '../prisma'
import { buildWhere, type JobQueryInput } from './queryJobs'

export const COMPANY_SIZE_BUCKETS = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const

export type LevelSizeCounts = {
  seniority: Record<string, number>
  companySizes: Record<string, number>
}

// A company size is on the company, so each bucket was one count over all jobs (5 scans). One query groups the jobs by company
// and the buckets are read from those companies; with more employers than this (the whole site, say) the five counts run as before.
const MAX_COMPANIES_TO_GROUP = 5000

async function companySizeCounts(base: JobQueryInput): Promise<number[]> {
  const perBucketCounts = () =>
    Promise.all(COMPANY_SIZE_BUCKETS.map((bucket) => prisma.job.count({ where: buildWhere({ ...base, companySizeBuckets: [bucket] }) })))

  const groups = await prisma.job.groupBy({
    by: ['companyId'],
    where: { AND: [buildWhere({ ...base, companySizeBuckets: undefined }), { companyId: { not: null } }] },
    _count: { _all: true },
  })
  if (groups.length > MAX_COMPANIES_TO_GROUP) return perBucketCounts()

  const companies = groups.length
    ? await prisma.company.findMany({
        where: { id: { in: groups.map((g) => g.companyId as string) }, sizeBucket: { in: [...COMPANY_SIZE_BUCKETS] } },
        select: { id: true, sizeBucket: true },
      })
    : []
  const bucketOf = new Map(companies.map((c) => [c.id, c.sizeBucket]))
  const totals = new Map<string, number>()
  for (const g of groups) {
    const bucket = g.companyId ? bucketOf.get(g.companyId) : null
    if (bucket) totals.set(bucket, (totals.get(bucket) ?? 0) + g._count._all)
  }
  return COMPANY_SIZE_BUCKETS.map((bucket) => totals.get(bucket) ?? 0)
}

export async function loadLevelSizeCounts(base: JobQueryInput): Promise<LevelSizeCounts> {
  const [levelRows, sizeCounts] = await Promise.all([
    prisma.job.groupBy({
      by: ['experienceLevel'],
      where: { AND: [buildWhere({ ...base, seniorityLevels: undefined }), { experienceLevel: { not: null } }] },
      _count: { _all: true },
    }),
    companySizeCounts(base),
  ])

  const seniority: Record<string, number> = {}
  for (const row of levelRows) if (row.experienceLevel) seniority[row.experienceLevel] = row._count._all

  return {
    seniority,
    companySizes: Object.fromEntries(COMPANY_SIZE_BUCKETS.map((bucket, i) => [bucket, sizeCounts[i] ?? 0])),
  }
}
