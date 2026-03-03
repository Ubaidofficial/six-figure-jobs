import crypto from 'node:crypto'
import type { ScrapeRun } from '@prisma/client'

import { prisma } from './prisma'

export type ScrapeStatus = {
  id: string
  status: 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  stats: {
    jobsAdded: number
    failures: number
    failedSources: string[]
  }
  error?: string
  warnings?: string[]
  aiEnrichmentError?: string
}

type StatusExtras = {
  error?: string
  warnings?: string[]
  failedSources?: string[]
  aiEnrichmentError?: string
}

function parseErrorLog(raw?: string | null): StatusExtras {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as StatusExtras
    if (parsed && typeof parsed === 'object') return parsed
    return {}
  } catch {
    return { error: raw }
  }
}

function mergeExtras(base: StatusExtras, patch: StatusExtras): StatusExtras {
  const warnings = [
    ...(Array.isArray(base.warnings) ? base.warnings : []),
    ...(Array.isArray(patch.warnings) ? patch.warnings : []),
  ]

  return {
    error: patch.error ?? base.error,
    aiEnrichmentError: patch.aiEnrichmentError ?? base.aiEnrichmentError,
    failedSources: patch.failedSources ?? base.failedSources,
    warnings: warnings.length ? warnings : base.warnings,
  }
}

function mapRunToStatus(run: ScrapeRun): ScrapeStatus {
  const extras = parseErrorLog(run.errorLog)
  return {
    id: run.id,
    status: (run.status as ScrapeStatus['status']) || 'running',
    startedAt: run.startedAt,
    completedAt: run.completedAt ?? undefined,
    stats: {
      jobsAdded: run.jobsNew ?? 0,
      failures: run.companiesFailed ?? 0,
      failedSources: extras.failedSources ?? [],
    },
    error: extras.error,
    warnings: extras.warnings,
    aiEnrichmentError: extras.aiEnrichmentError,
  }
}

export async function createScrapeJob(): Promise<string> {
  const id = crypto.randomUUID()
  try {
    await prisma.scrapeRun.create({
      data: {
        id,
        status: 'running',
        startedAt: new Date(),
        jobsNew: 0,
        jobsFound: 0,
        companiesFailed: 0,
      },
    })
  } catch (err) {
    console.error('[scrape-status] create failed:', err)
  }
  return id
}

export async function updateScrapeStatus(
  id: string,
  update: Partial<ScrapeStatus>,
) {
  try {
    const current = await prisma.scrapeRun.findUnique({ where: { id } })
    if (!current) return

    const extras = mergeExtras(parseErrorLog(current.errorLog), {
      error: update.error,
      warnings: update.warnings,
      failedSources: update.stats?.failedSources,
      aiEnrichmentError: update.aiEnrichmentError,
    })

    const data: Record<string, any> = {}
    if (update.status) data.status = update.status
    if (update.completedAt) data.completedAt = update.completedAt
    if (update.stats) {
      data.jobsNew = update.stats.jobsAdded
      data.jobsFound = update.stats.jobsAdded
      data.companiesFailed = update.stats.failures
    }

    if (Object.keys(extras).length > 0) {
      data.errorLog = JSON.stringify(extras)
    }

    if (Object.keys(data).length === 0) return
    await prisma.scrapeRun.update({ where: { id }, data })
  } catch (err) {
    console.error('[scrape-status] update failed:', err)
  }
}

export async function getScrapeStatus(id: string): Promise<ScrapeStatus | null> {
  try {
    const run = await prisma.scrapeRun.findUnique({ where: { id } })
    if (!run) return null
    return mapRunToStatus(run)
  } catch (err) {
    console.error('[scrape-status] get failed:', err)
    return null
  }
}

export async function addScrapeWarning(id: string, warning: string) {
  try {
    const current = await prisma.scrapeRun.findUnique({ where: { id } })
    if (!current) return
    const extras = mergeExtras(parseErrorLog(current.errorLog), {
      warnings: [warning],
    })
    await prisma.scrapeRun.update({
      where: { id },
      data: { errorLog: JSON.stringify(extras) },
    })
  } catch (err) {
    console.error('[scrape-status] warning failed:', err)
  }
}

export async function completeScrapeJob(id: string, stats: ScrapeStatus['stats']) {
  await updateScrapeStatus(id, {
    status: 'completed',
    completedAt: new Date(),
    stats,
  })
}

export async function failScrapeJob(id: string, error: string) {
  await updateScrapeStatus(id, {
    status: 'failed',
    completedAt: new Date(),
    error,
  })
}
