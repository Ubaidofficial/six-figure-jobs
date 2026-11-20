// lib/jobs/levelSizeFacets.ts
//
// How many jobs each Seniority and Company size option of the listing filter would show, with the page's other filters
// applied (a group's own choice is left out, so picking "Senior" still shows how many "Staff" jobs there are). The
// options had no counts, so a visitor could pick one that leaves nothing. Seniority is Job.experienceLevel (read from the
// title at ingest), counted in one query; company size is on the company, so each bucket is one count.
import { prisma } from '../prisma'
import { buildWhere, type JobQueryInput } from './queryJobs'

export const COMPANY_SIZE_BUCKETS = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const

export type LevelSizeCounts = {
  seniority: Record<string, number>
  companySizes: Record<string, number>
}

export async function loadLevelSizeCounts(base: JobQueryInput): Promise<LevelSizeCounts> {
  const [levelRows, sizeCounts] = await Promise.all([
    prisma.job.groupBy({
      by: ['experienceLevel'],
      where: { AND: [buildWhere({ ...base, seniorityLevels: undefined }), { experienceLevel: { not: null } }] },
      _count: { _all: true },
    }),
    Promise.all(
      COMPANY_SIZE_BUCKETS.map((bucket) =>
        prisma.job.count({ where: buildWhere({ ...base, companySizeBuckets: [bucket] }) }),
      ),
    ),
  ])

  const seniority: Record<string, number> = {}
  for (const row of levelRows) if (row.experienceLevel) seniority[row.experienceLevel] = row._count._all

  return {
    seniority,
    companySizes: Object.fromEntries(COMPANY_SIZE_BUCKETS.map((bucket, i) => [bucket, sizeCounts[i] ?? 0])),
  }
}
