import type { Prisma } from '@prisma/client'

import { getDateThreshold, MAX_DISPLAY_AGE_DAYS } from '../ingest/jobAgeFilter'

export const MAX_INDEXABLE_JOB_AGE_DAYS = MAX_DISPLAY_AGE_DAYS

export type JobFreshnessInput = {
  lastSeenAt?: Date | string | null
  postedAt?: Date | string | null
  createdAt?: Date | string | null
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// The date a visitor reads as "posted": the employer's posting date, else the day we first stored the job. NOT lastSeenAt:
// every scrape that finds a job still listed refreshes that, so a job posted six months ago stayed "fresh" for ever
// (2026-11-15 audit: 9,038 of 28,685 live jobs were posted over 45 days ago, 12,829 over 21 days ago, all kept by
// being seen again). Whether the employer still lists it is handled separately (run-expiry sets isExpired).
export function resolveJobFreshnessDate(job: JobFreshnessInput): Date | null {
  const postedAt = toDate(job.postedAt)
  if (postedAt) return postedAt

  const createdAt = toDate(job.createdAt)
  if (createdAt) return createdAt

  return null
}

export function isJobFresh(
  job: JobFreshnessInput,
  maxAgeDays: number = MAX_INDEXABLE_JOB_AGE_DAYS,
  now: Date = new Date(),
): boolean {
  const freshnessDate = resolveJobFreshnessDate(job)
  if (!freshnessDate) return false

  const cutoff = getDateThreshold(maxAgeDays, now)
  return freshnessDate.getTime() >= cutoff.getTime()
}

export function buildFreshJobWhere(
  maxAgeDays: number = MAX_DISPLAY_AGE_DAYS,
  asOf: Date = new Date(),
): Prisma.JobWhereInput {
  const cutoff = getDateThreshold(maxAgeDays, asOf)

  return {
    OR: [{ postedAt: { gte: cutoff } }, { postedAt: null, createdAt: { gte: cutoff } }],
  }
}

/** The other side of buildFreshJobWhere: posted (else stored) before the cutoff. Written out, not NOT(fresh): a NOT
 *  over the null postedAt branch would drop the rows that have no postedAt. */
export function buildStaleJobWhere(
  maxAgeDays: number = MAX_DISPLAY_AGE_DAYS,
  asOf: Date = new Date(),
): Prisma.JobWhereInput {
  const cutoff = getDateThreshold(maxAgeDays, asOf)

  return {
    OR: [{ postedAt: { lt: cutoff } }, { postedAt: null, createdAt: { lt: cutoff } }],
  }
}
