// lib/jobs/expiry.ts
// Handles marking jobs as expired

import { prisma } from '../prisma'
import { notifyJobDeletedForIndexing } from './indexingNotifications'
import { triggerSitemapRevalidation } from '../seo/sitemapRevalidate'

let sitemapRevalidatedThisProcess = false

async function guardedSitemapRevalidate() {
  if (sitemapRevalidatedThisProcess) return
  sitemapRevalidatedThisProcess = true
  await triggerSitemapRevalidation()
}

/** URL_DELETED notices queued at once. Each runs a few database queries; see notifyDeleted. */
export const NOTIFY_CONCURRENCY = 3

/**
 * Queues the URL_DELETED notices a few at a time. Sending a whole batch at once exhausted Prisma's connection pool
 * (5 connections outside production): on 2026-11-23 the full sync expired 386 closed freehire jobs and 177 of their
 * notices failed with "Timed out fetching a new connection from the connection pool", and the boards step's expiry hit
 * the same limit 329 times, so Google was never told those pages were gone. The jobs themselves were expired.
 */
async function notifyDeleted(jobs: Parameters<typeof notifyJobDeletedForIndexing>[0][]): Promise<void> {
  for (let i = 0; i < jobs.length; i += NOTIFY_CONCURRENCY) {
    await Promise.all(jobs.slice(i, i + NOTIFY_CONCURRENCY).map((job) => notifyJobDeletedForIndexing(job)))
  }
}

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

  await notifyDeleted(expiringJobs)

  if (result.count > 0) {
    await guardedSitemapRevalidate()
  }

  return { expired: result.count }
}

/** Expire specific jobs (closed at the source). Same side effects as the other expiry paths. */
export async function expireJobsByIds(ids: string[]): Promise<{ expired: number }> {
  if (ids.length === 0) return { expired: 0 }
  const today = new Date()
  const jobs = await prisma.job.findMany({
    where: { id: { in: ids }, isExpired: false },
    select: { id: true, title: true, externalId: true, source: true },
  })
  const result = await prisma.job.updateMany({
    where: { id: { in: jobs.map((j) => j.id) }, isExpired: false },
    data: { isExpired: true, validThrough: today, expiresAt: today },
  })
  await notifyDeleted(jobs)
  if (result.count > 0) await guardedSitemapRevalidate()
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

  await notifyDeleted(expiringJobs)

  if (result.count > 0) {
    await guardedSitemapRevalidate()
  }

  return { expired: result.count }
}
