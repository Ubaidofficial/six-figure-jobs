// lib/jobs/expiry.ts
// Handles marking jobs as expired

import { prisma } from '../prisma'
import { notifyJobDeletedForIndexing } from './indexingNotifications'

export async function runExpiryCycle(): Promise<{ expired: number }> {
  // Mark jobs as expired if they haven't been seen in 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const today = new Date()

  const expiringJobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      updatedAt: { lt: sevenDaysAgo },
    },
    select: {
      id: true,
      title: true,
      externalId: true,
      source: true,
    },
  })

  const result = await prisma.job.updateMany({
    where: {
      isExpired: false,
      updatedAt: { lt: sevenDaysAgo },
    },
    data: {
      isExpired: true,
      validThrough: today,
      expiresAt: today,
    },
  })

  await Promise.all(expiringJobs.map((job) => notifyJobDeletedForIndexing(job)))

  return { expired: result.count }
}

export async function markJobExpired(jobId: string): Promise<void> {
  const today = new Date()
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      externalId: true,
      source: true,
    },
  })

  await prisma.job.update({
    where: { id: jobId },
    data: { isExpired: true, validThrough: today, expiresAt: today },
  })

  if (job) await notifyJobDeletedForIndexing(job)
}

export async function markJobsExpiredBySource(
  source: string, 
  externalIds: string[]
): Promise<{ expired: number }> {
  const today = new Date()
  const expiringJobs = await prisma.job.findMany({
    where: {
      source,
      isExpired: false,
      NOT: {
        externalId: { in: externalIds },
      },
    },
    select: {
      id: true,
      title: true,
      externalId: true,
      source: true,
    },
  })

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
      validThrough: today,
      expiresAt: today,
    },
  })

  await Promise.all(expiringJobs.map((job) => notifyJobDeletedForIndexing(job)))

  return { expired: result.count }
}
