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

export function resolveJobFreshnessDate(job: JobFreshnessInput): Date | null {
  const lastSeenAt = toDate(job.lastSeenAt)
  if (lastSeenAt) return lastSeenAt

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
    OR: [
      { lastSeenAt: { gte: cutoff } },
      {
        lastSeenAt: null,
        postedAt: { gte: cutoff },
      },
      {
        lastSeenAt: null,
        postedAt: null,
        createdAt: { gte: cutoff },
      },
    ],
  }
}
