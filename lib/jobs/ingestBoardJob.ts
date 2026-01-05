// lib/jobs/ingestBoardJob.ts
// Wrapper for ingesting jobs from external job boards (RemoteOK, RemoteAI, etc.)
//
// This is now a thin adapter that converts BoardJobInput to ScrapedJobInput
// and delegates to the central ingest function.
//
// The central ingest handles:
// - Company resolution
// - Deduplication
// - Source priority
// - Create/update/skip decisions

import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'
import type { ScrapedJobInput } from '../ingest/types'
import type { AtsProvider } from '../scrapers/ats/types'

// =============================================================================
// Types (kept for backwards compatibility)
// =============================================================================

export type BoardIngestResult = 'new' | 'updated' | 'skipped'

export interface BoardJobInput {
  /** Stable identifier within the board (slug, ID, URL, etc.) */
  externalId: string

  /** Human-readable job title */
  title: string

  /** Canonical job URL on the board */
  url: string

  /** Raw company name as scraped from the board */
  rawCompanyName: string | null

  /** Optional website */
  companyWebsiteUrl?: string | null

  /** Optional "best guess" location text ("Remote – US", "London, UK", etc.) */
  locationText?: string | null

  /** Optional salary info (numbers should be in the original currency units) */
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  salaryInterval?: string | null

  /** Remote / type hints */
  isRemote?: boolean | null
  employmentType?: string | null

  /** Optional LinkedIn URL */
  companyLinkedInUrl?: string | null

  /** Timestamps if the board exposes them */
  postedAt?: Date | null
  updatedAt?: Date | null

  /** Optional pre-parsed description (HTML or text) */
  descriptionHtml?: string | null
  descriptionText?: string | null

  /** Optional extra metadata */
  applyUrl?: string | null

  /** Optional ATS hints discovered on the board */
  explicitAtsProvider?: AtsProvider | null
  explicitAtsUrl?: string | null

  /** Raw blob for debugging / future use */
  raw?: Record<string, any> | null
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Ingest a job from a job board.
 * 
 * This is a backwards-compatible wrapper around the new central ingest function.
 * It converts BoardJobInput to ScrapedJobInput and delegates to ingestJob().
 * 
 * @param boardName - Board identifier (e.g., "remoteok", "remote100k")
 * @param job - Job data from the board scraper
 * @returns 'new' | 'updated' | 'skipped'
 */
export async function ingestBoardJob(
  boardName: string,
  job: BoardJobInput,
): Promise<BoardIngestResult> {
  // Validate required fields
  if (!job.title || !job.url || !job.externalId) {
    console.warn(
      `[board:${boardName}] Skipping job with missing fields:`,
      job.title,
      job.url,
      job.externalId,
    )
    return 'skipped'
  }

  // Convert BoardJobInput to ScrapedJobInput
  const scrapedJob: ScrapedJobInput = {
    // Required fields
    externalId: job.externalId,
    title: job.title,
    source: makeBoardSource(boardName),

    // Company info
    rawCompanyName: job.rawCompanyName,
    companyWebsiteUrl: job.companyWebsiteUrl ?? null,
    companyLinkedInUrl: job.companyLinkedInUrl ?? null,

    // URLs
    url: job.url,
    applyUrl: job.applyUrl ?? job.url,

    // Location
    locationText: job.locationText ?? null,
    isRemote: job.isRemote ?? null,

    // Salary
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    salaryCurrency: job.salaryCurrency ?? null,
    salaryInterval: job.salaryInterval ?? 'year',
    salaryRaw:
      (job.raw &&
      typeof (job.raw as any).salaryText === 'string' &&
      (job.raw as any).salaryText.trim()
        ? String((job.raw as any).salaryText)
        : null) ??
      job.descriptionText ??
      null,

    // Job details
    employmentType: job.employmentType ?? null,
    descriptionHtml: job.descriptionHtml ?? null,
    descriptionText: job.descriptionText ?? null,

    // Timestamps
    postedAt: job.postedAt ?? null,
    updatedAt: job.updatedAt ?? null,

    // ATS hints
    explicitAtsProvider: job.explicitAtsProvider ?? null,
    explicitAtsUrl: job.explicitAtsUrl ?? null,

    // Raw data
    raw: job.raw ?? null,
  }

  // Delegate to central ingest
  const result = await ingestJob(scrapedJob)

  // Map new result status to old return type
  switch (result.status) {
    case 'created':
      return 'new'
    case 'updated':
    case 'upgraded':
      return 'updated'
    case 'skipped':
    case 'error':
    default:
      return 'skipped'
  }
}
