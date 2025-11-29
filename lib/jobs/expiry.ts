// lib/jobs/expiry.ts
// Handles marking jobs as expired

import { prisma } from '../prisma'

export async function runExpiryCycle(): Promise<{ expired: number }> {
  // Mark jobs as expired if they haven't been seen in 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const result = await prisma.job.updateMany({
    where: {
      isExpired: false,
      updatedAt: { lt: sevenDaysAgo },
    },
    data: {
      isExpired: true,
    },
  })

  return { expired: result.count }
}

export async function markJobExpired(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { isExpired: true },
  })
}

export async function markJobsExpiredBySource(
  source: string, 
  externalIds: string[]
): Promise<{ expired: number }> {
  // Mark jobs from a source as expired if their external IDs aren't in the list
  const result = await prisma.job.updateMany({
    where: {
      source,
      isExpired: false,
      NOT: {
        externalId: { in: externalIds },
      },
    },
    data: {
      isExpired: true,
    },
  })

  return { expired: result.count }
}
