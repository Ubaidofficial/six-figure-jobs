// lib/ingest/types.ts
// Unified types for job ingestion from any source (ATS or board)
//
// All scrapers (board or ATS) should produce a ScrapedJobInput object,
// which then goes through the central ingest function.

import type { AtsProvider } from '../scrapers/ats/types'

// =============================================================================
// Ingest Result Types
// =============================================================================

export type IngestStatus = 
  | 'created'      // New job created
  | 'updated'      // Existing job updated (same or higher priority source)
  | 'upgraded'     // Job upgraded to better source (e.g., board → ATS)
  | 'skipped'      // Skipped (lower priority source or invalid data)
  | 'error'        // Error during ingestion

export interface IngestResult {
  status: IngestStatus
  jobId?: string
  reason?: string
  dedupeKey?: string
}

export interface IngestStats {
  created: number
  updated: number
  upgraded: number
  skipped: number
  errors: number
}

export function createEmptyStats(): IngestStats {
  return {
    created: 0,
    updated: 0,
    upgraded: 0,
    skipped: 0,
    errors: 0,
  }
}

export function mergeStats(a: IngestStats, b: IngestStats): IngestStats {
  return {
    created: a.created + b.created,
    updated: a.updated + b.updated,
    upgraded: a.upgraded + b.upgraded,
    skipped: a.skipped + b.skipped,
    errors: a.errors + b.errors,
  }
}

// =============================================================================
// Scraped Job Input (unified format for all sources)
// =============================================================================

export interface ScrapedJobInput {
  // === Required fields ===
  
  /** Unique identifier within the source (job ID, slug, or URL) */
  externalId: string
  
  /** Job title as scraped */
  title: string
  
  /** Source identifier (e.g., "board:remoteok", "ats:greenhouse") */
  source: string

  // === Company info ===
  
  /** Raw company name as scraped */
  rawCompanyName: string | null
  
  /** Company website URL if available */
  companyWebsiteUrl?: string | null
  
  /** Company logo URL if available */
  companyLogoUrl?: string | null

  // === Job URLs ===
  
  /** Canonical job URL (detail page) */
  url: string | null
  
  /** Application URL (may be same as url) */
  applyUrl?: string | null

  // === Location ===
  
  /** Raw location text as scraped */
  locationText?: string | null
  
  /** Is this explicitly marked as remote? */
  isRemote?: boolean | null
  
  /** Remote region if specified (e.g., "US only", "EMEA") */
  remoteRegion?: string | null

  // === Salary ===
  
  /** Raw salary text as scraped */
  salaryRaw?: string | null
  
  /** Parsed minimum salary (in original currency) */
  salaryMin?: number | null
  
  /** Parsed maximum salary (in original currency) */
  salaryMax?: number | null
  
  /** Salary currency code (USD, EUR, GBP, etc.) */
  salaryCurrency?: string | null
  
  /** Salary interval (year, month, hour, etc.) */
  salaryInterval?: string | null

  // === Job details ===
  
  /** Employment type (Full-time, Part-time, Contract, etc.) */
  employmentType?: string | null
  
  /** Department or team */
  department?: string | null
  
  /** Job description as HTML */
  descriptionHtml?: string | null
  
  /** Job description as plain text */
  descriptionText?: string | null

  // === Timestamps ===
  
  /** When the job was posted */
  postedAt?: Date | null
  
  /** When the job was last updated at source */
  updatedAt?: Date | null

  // === ATS hints (for board scrapers that detect ATS) ===
  
  /** Detected ATS provider from apply URL */
  explicitAtsProvider?: AtsProvider | null
  
  /** Detected ATS careers URL */
  explicitAtsUrl?: string | null

  // === Raw data for debugging ===
  
  /** Original scraped data blob */
  raw?: Record<string, unknown> | null
}

// =============================================================================
// Company Resolution Types
// =============================================================================

export interface ResolvedCompany {
  id: string
  name: string
  slug: string
  atsProvider?: string | null
  atsUrl?: string | null
  lastScrapedAt?: Date | null
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if a scraped job has the minimum required fields.
 */
export function isValidScrapedJob(job: Partial<ScrapedJobInput>): job is ScrapedJobInput {
  return Boolean(
    job.externalId &&
    job.title &&
    job.source &&
    (job.url || job.applyUrl) // Need at least one URL
  )
}

/**
 * Get validation errors for a scraped job.
 */
export function getValidationErrors(job: Partial<ScrapedJobInput>): string[] {
  const errors: string[] = []
  
  if (!job.externalId) errors.push('Missing externalId')
  if (!job.title) errors.push('Missing title')
  if (!job.source) errors.push('Missing source')
  if (!job.url && !job.applyUrl) errors.push('Missing url or applyUrl')
  
  return errors
}

// =============================================================================
// Factory Helpers
// =============================================================================

/**
 * Create a ScrapedJobInput with defaults filled in.
 */
export function createScrapedJob(
  partial: Partial<ScrapedJobInput> & Pick<ScrapedJobInput, 'externalId' | 'title' | 'source'>
): ScrapedJobInput {
  return {
    externalId: partial.externalId,
    title: partial.title,
    source: partial.source,
    rawCompanyName: partial.rawCompanyName ?? null,
    url: partial.url ?? null,
    applyUrl: partial.applyUrl ?? partial.url ?? null,
    locationText: partial.locationText ?? null,
    isRemote: partial.isRemote ?? null,
    salaryMin: partial.salaryMin ?? null,
    salaryMax: partial.salaryMax ?? null,
    salaryCurrency: partial.salaryCurrency ?? null,
    salaryInterval: partial.salaryInterval ?? 'year',
    employmentType: partial.employmentType ?? null,
    descriptionHtml: partial.descriptionHtml ?? null,
    descriptionText: partial.descriptionText ?? null,
    postedAt: partial.postedAt ?? null,
    updatedAt: partial.updatedAt ?? null,
    companyWebsiteUrl: partial.companyWebsiteUrl ?? null,
    companyLogoUrl: partial.companyLogoUrl ?? null,
    remoteRegion: partial.remoteRegion ?? null,
    department: partial.department ?? null,
    explicitAtsProvider: partial.explicitAtsProvider ?? null,
    explicitAtsUrl: partial.explicitAtsUrl ?? null,
    salaryRaw: partial.salaryRaw ?? null,
    raw: partial.raw ?? null,
  }
}