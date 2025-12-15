// lib/ingest/index.ts
// Central job ingestion with deduplication and source priority
//
// This is the single entry point for ingesting jobs from ANY source (ATS or board).
// It handles:
// 1. Company resolution (find or create)
// 2. Dedupe key generation
// 3. Source priority comparison
// 4. Create / update / skip decisions
//
// Usage:
//   import { ingestJob } from '@/lib/ingest'
//   const result = await ingestJob(scrapedJobInput)

import { prisma } from '../prisma'
import { upsertCompanyFromBoard } from '../companies/upsertFromBoard'
import {
  normalizeSalary,
  parseSalaryFromText,
  validateHighSalaryEligibility,
  type SalarySource,
} from '../normalizers/salary'
import { normalizeLocation as normalizeLocationData } from '../normalizers/location'
import { normalizeRole } from '../normalizers/role'
import slugify from 'slugify'
import { isJobTooOld, MAX_INGEST_AGE_DAYS } from './jobAgeFilter'
import { parseGreenhouseSalary } from './greenhouseSalaryParser'
import { getShortStableIdForJobId } from '../jobs/jobSlug'

import { getSourcePriority, isAtsSource, isBoardSource } from './sourcePriority'
import { makeJobDedupeKey, normalizeLocation, normalizeUrl } from './dedupeHelpers'
import type {
  ScrapedJobInput,
  IngestResult,
  IngestStats,
  ResolvedCompany,
  createEmptyStats,
} from './types'
import { isValidScrapedJob, getValidationErrors } from './types'

// =============================================================================
// Configuration
// =============================================================================

/** How many days back to consider a company's ATS scrape as "recent" */
const ATS_RECENT_DAYS = 7

// =============================================================================
// Main Ingest Function
// =============================================================================

/**
 * Ingest a scraped job into the database.
 * * This function handles:
 * - Company resolution (find existing or create new)
 * - Dedupe key generation
 * - Finding existing jobs with same dedupe key or URL
 * - Source priority comparison
 * - Creating new jobs or updating/upgrading existing ones
 */
export async function ingestJob(input: ScrapedJobInput): Promise<IngestResult> {
  // 1. Validate input
  if (!isValidScrapedJob(input)) {
    const errors = getValidationErrors(input)
    console.warn(`[ingest] Invalid job input: ${errors.join(', ')}`, (input as any).title ?? 'unknown')
    return { status: 'skipped', reason: `validation-failed: ${errors.join(', ')}` }
  }

  try {
    // 2. Resolve company
    const company = await resolveCompany(input)
    if (!company) {
      return { status: 'skipped', reason: 'no-company-resolved' }
    }

    // 3. Generate dedupe key
    const dedupeKey = makeJobDedupeKey(company.id, input.title, input.locationText)
    const incomingPriority = getSourcePriority(input.source)

    // 4. Look for existing job by dedupe key (active jobs only)
    const existingByKey = await prisma.job.findFirst({
      where: {
        companyId: company.id,
        dedupeKey: dedupeKey,
        isExpired: false,
      },
    })

    // 5. Also look for existing job by URL (fallback matching)
    const normalizedUrl = normalizeUrl(input.url)
    const existingByUrl = normalizedUrl
      ? await prisma.job.findFirst({
          where: {
            url: input.url,
            isExpired: false,
          },
        })
      : null

    // Use whichever match we found (prefer dedupe key match)
    const existing = existingByKey || existingByUrl

    // 6. Decision logic
    if (!existing) {
      // No existing job - create new one
      return await createNewJob(company, input, dedupeKey, incomingPriority)
    }

    const existingPriority = existing.sourcePriority ?? 20

    if (incomingPriority > existingPriority) {
      // Incoming source is better - upgrade the job
      return await upgradeJob(existing, company, input, dedupeKey, incomingPriority)
    }

    if (incomingPriority === existingPriority) {
      // Same priority - refresh/update minor fields
      return await refreshJob(existing, input)
    }

    // Incoming source is lower priority - skip
    // But first, check if this should be marked as unverified board job
    if (isBoardSource(input.source) && isAtsSource(existing.source)) {
      // Board job exists in ATS - this is expected, just skip
      return { 
        status: 'skipped', 
        reason: 'lower-priority-ats-exists',
        jobId: existing.id,
        dedupeKey,
      }
    }

    return { 
      status: 'skipped', 
      reason: 'lower-priority',
      jobId: existing.id,
      dedupeKey,
    }

  } catch (error: any) {
    console.error(`[ingest] Error ingesting job "${input.title}":`, error?.message || error)
    return { status: 'error', reason: error?.message || 'unknown-error' }
  }
}

// =============================================================================
// Company Resolution
// =============================================================================

async function resolveCompany(input: ScrapedJobInput): Promise<ResolvedCompany | null> {
  // Use the existing upsertCompanyFromBoard helper
  // This handles name cleaning, ATS detection, and deduplication
  const company = await upsertCompanyFromBoard({
    rawName: input.rawCompanyName,
    source: input.source,
    websiteUrl: input.companyWebsiteUrl ?? null,
    linkedinUrl: input.companyLinkedInUrl ?? null,
    applyUrl: input.applyUrl ?? input.url ?? null,
    explicitAtsProvider: input.explicitAtsProvider ?? null,
    explicitAtsUrl: input.explicitAtsUrl ?? null,
  })

  if (!company) {
    return null
  }

  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    atsProvider: company.atsProvider ?? null,
    atsUrl: company.atsUrl ?? null,
    lastScrapedAt: company.lastScrapedAt ?? null,
  }
}

// =============================================================================
// Job Creation
// =============================================================================

async function createNewJob(
  company: ResolvedCompany,
  input: ScrapedJobInput,
  dedupeKey: string,
  priority: number
): Promise<IngestResult> {
  // Build job ID
  const jobId = buildJobId(input.source, input.externalId)

  // Process salary
  const salaryData = processSalary(input)

  if (salaryData.salaryValidated !== true) {
    return { status: 'skipped', reason: 'salary-not-eligible', dedupeKey }
  }

  const strictExclusionReason = getStrictExclusionReason(input.title, input.employmentType)
  if (strictExclusionReason) {
    return { status: 'skipped', reason: strictExclusionReason, dedupeKey }
  }

  // Process location
  const locationData = processLocation(input)

  // Infer role
  const roleData = normalizeRole(input.title)

  // Check if this is an unverified board job
  const isUnverifiedBoardJob = await checkUnverifiedBoardJob(company, input, dedupeKey)

  const jobData = {
    id: jobId,
    shortId: getShortStableIdForJobId(jobId),
    title: input.title,
    company: company.name,
    companyId: company.id,
    companyLogo: input.companyLogoUrl ?? null,
    source: input.source,

    // Dedupe fields
    dedupeKey,
    sourcePriority: priority,
    isUnverifiedBoardJob,

    // Location
    locationRaw: input.locationText ?? null,
    city: locationData.city ?? null,
    citySlug: locationData.citySlug ?? null,
    countryCode: locationData.countryCode ?? null,
    remote: locationData.isRemote ?? input.isRemote ?? false,
    remoteRegion: input.remoteRegion ?? null,
    remoteMode: locationData.remoteMode ?? null,

    // Salary
    salaryRaw: input.salaryRaw ?? null,
    salaryMin: salaryData.salaryMin,
    salaryMax: salaryData.salaryMax,
    salaryCurrency: salaryData.salaryCurrency,
    salaryPeriod: salaryData.salaryInterval,
    minAnnual: salaryData.minAnnual,
    maxAnnual: salaryData.maxAnnual,
    currency: salaryData.currency,
    isHighSalary: salaryData.isHighSalary,
    // v2.9 hard gate: flags cannot qualify jobs (numeric + validated only)
    isHundredKLocal: false,

    // Salary quality (v2.9)
    salaryValidated: salaryData.salaryValidated,
    salaryConfidence: salaryData.salaryConfidence,
    salarySource: salaryData.salarySource,
    salaryParseReason: salaryData.salaryParseReason,
    salaryNormalizedAt: salaryData.salaryNormalizedAt,
    salaryRejectedAt: salaryData.salaryRejectedAt,
    salaryRejectedReason: salaryData.salaryRejectedReason,

    // Job details
    type: input.employmentType ?? 'Full-time',
    employmentType: input.employmentType ?? null,
    experienceLevel: inferExperienceLevelFromTitle(input.title),
    applyUrl: input.applyUrl ?? input.url ?? null,
    url: input.url ?? null,
    descriptionHtml: input.descriptionHtml ?? null,

    // v2.7: avoid writing empty-string role slugs (canonical-only enforcement happens in normalizeRole)
    roleSlug: roleData.roleSlug ? roleData.roleSlug : null,

    // Tracking
    externalId: input.externalId,
    isExpired: false,
    lastSeenAt: new Date(),
    postedAt: input.postedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  try {
    await prisma.job.create({ data: jobData })
    
    return {
      status: 'created',
      jobId,
      dedupeKey,
    }
  } catch (error: any) {
    // Handle unique constraint violation (race condition)
    if (error?.code === 'P2002') {
      const target = error?.meta?.target
      const targets = Array.isArray(target)
        ? target
        : typeof target === 'string'
          ? [target]
          : []
      if (targets.some((t) => String(t).toLowerCase().includes('shortid'))) {
        console.error(`[ingest] shortId collision on create: ${jobId}`)
        throw error
      }
      console.log(`[ingest] Job already exists (race condition): ${jobId}`)
      return { status: 'skipped', reason: 'already-exists', jobId, dedupeKey }
    }
    throw error
  }
}

// =============================================================================
// Job Upgrade (better source found)
// =============================================================================

async function upgradeJob(
  existing: any,
  company: ResolvedCompany,
  input: ScrapedJobInput,
  dedupeKey: string,
  priority: number
): Promise<IngestResult> {
  // Process salary
  const salaryData = processSalary(input)

  if (salaryData.salaryValidated !== true) {
    return { status: 'skipped', reason: 'salary-not-eligible', jobId: existing.id, dedupeKey }
  }

  const strictExclusionReason = getStrictExclusionReason(input.title, input.employmentType)
  if (strictExclusionReason) {
    return { status: 'skipped', reason: strictExclusionReason, jobId: existing.id, dedupeKey }
  }

  // Process location
  const locationData = processLocation(input)

  // Infer role
  const roleData = normalizeRole(input.title)

  const updateData = {
    // Update source info
    source: input.source,
    sourcePriority: priority,
    dedupeKey,
    externalId: input.externalId,
    isUnverifiedBoardJob: false, // Upgraded jobs are verified

    // Update title if provided
    title: input.title,
    shortId: getShortStableIdForJobId(existing.id),
    company: company.name,
    companyId: company.id,
    companyLogo: input.companyLogoUrl ?? existing.companyLogo,

    // Location - prefer new data
    locationRaw: input.locationText ?? existing.locationRaw,
    city: locationData.city ?? existing.city,
    citySlug: locationData.citySlug ?? existing.citySlug,
    countryCode: locationData.countryCode ?? existing.countryCode,
    remote: locationData.isRemote ?? input.isRemote ?? existing.remote,
    remoteRegion: input.remoteRegion ?? existing.remoteRegion,
    remoteMode: locationData.remoteMode ?? existing.remoteMode,

    // Salary - prefer new data if available
    salaryRaw: input.salaryRaw ?? existing.salaryRaw,
    salaryMin: salaryData.salaryMin ?? existing.salaryMin,
    salaryMax: salaryData.salaryMax ?? existing.salaryMax,
    salaryCurrency: salaryData.salaryCurrency ?? existing.salaryCurrency,
    salaryPeriod: salaryData.salaryInterval ?? existing.salaryPeriod,
    minAnnual: salaryData.minAnnual ?? existing.minAnnual,
    maxAnnual: salaryData.maxAnnual ?? existing.maxAnnual,
    currency: salaryData.currency ?? existing.currency,
    isHighSalary: salaryData.isHighSalary ?? existing.isHighSalary,
    // v2.9 hard gate: flags cannot qualify jobs (numeric + validated only)
    isHundredKLocal: false,

    // Salary quality (v2.9)
    salaryValidated: salaryData.salaryValidated,
    salaryConfidence: salaryData.salaryConfidence,
    salarySource: salaryData.salarySource,
    salaryParseReason: salaryData.salaryParseReason,
    salaryNormalizedAt: salaryData.salaryNormalizedAt,
    salaryRejectedAt: salaryData.salaryRejectedAt,
    salaryRejectedReason: salaryData.salaryRejectedReason,

    // URLs - prefer new data
    applyUrl: input.applyUrl ?? input.url ?? existing.applyUrl,
    url: input.url ?? existing.url,
    descriptionHtml: input.descriptionHtml ?? existing.descriptionHtml,

    // Role (v2.7: avoid writing empty-string role slugs)
    roleSlug: roleData.roleSlug ? roleData.roleSlug : null,

    // Tracking
    isExpired: false,
    lastSeenAt: new Date(),
    postedAt: input.postedAt ?? existing.postedAt,
    updatedAt: new Date(),

    // v2.9: deterministic experience level from title
    experienceLevel: inferExperienceLevelFromTitle(input.title),
  }

  await prisma.job.update({
    where: { id: existing.id },
    data: updateData,
  })

  console.log(`[ingest] Upgraded job ${existing.id} from ${existing.source} to ${input.source}`)

  return {
    status: 'upgraded',
    jobId: existing.id,
    dedupeKey,
  }
}

// =============================================================================
// Job Refresh (same priority, update minor fields)
// =============================================================================

async function refreshJob(existing: any, input: ScrapedJobInput): Promise<IngestResult> {
  // Only update tracking fields and fill in missing data
  const updateData: any = {
    lastSeenAt: new Date(),
    updatedAt: new Date(),
    isExpired: false,
    shortId: getShortStableIdForJobId(existing.id),
  }

  // Fill in missing description
  if (!existing.descriptionHtml && input.descriptionHtml) {
    updateData.descriptionHtml = input.descriptionHtml
  }

  // Fill in missing salary
  if (!existing.salaryMin && !existing.salaryMax && (input.salaryMin || input.salaryMax)) {
    const salaryData = processSalary(input)
    if (salaryData.salaryValidated === true) {
      updateData.salaryMin = salaryData.salaryMin
      updateData.salaryMax = salaryData.salaryMax
      updateData.salaryCurrency = salaryData.salaryCurrency
      updateData.salaryPeriod = salaryData.salaryInterval
      updateData.minAnnual = salaryData.minAnnual
      updateData.maxAnnual = salaryData.maxAnnual
      updateData.isHighSalary = salaryData.isHighSalary
      updateData.isHundredKLocal = false

      updateData.salaryValidated = salaryData.salaryValidated
      updateData.salaryConfidence = salaryData.salaryConfidence
      updateData.salarySource = salaryData.salarySource
      updateData.salaryParseReason = salaryData.salaryParseReason
      updateData.salaryNormalizedAt = salaryData.salaryNormalizedAt
      updateData.salaryRejectedAt = salaryData.salaryRejectedAt
      updateData.salaryRejectedReason = salaryData.salaryRejectedReason
    }
  }

  // Fill in missing logo
  if (!existing.companyLogo && input.companyLogoUrl) {
    updateData.companyLogo = input.companyLogoUrl
  }

  await prisma.job.update({
    where: { id: existing.id },
    data: updateData,
  })

  return {
    status: 'updated',
    jobId: existing.id,
    dedupeKey: existing.dedupeKey,
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function buildJobId(source: string, externalId: string): string {
  // Sanitize externalId to be safe for use in ID
  const safeExternalId = externalId
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 200)

  return `${source}:${safeExternalId}`
}

function processSalary(input: ScrapedJobInput) {
  let salaryMin = input.salaryMin ?? null
  let salaryMax = input.salaryMax ?? null
  let salaryCurrency = input.salaryCurrency ?? null
  let salaryInterval = input.salaryInterval ?? 'year'
  let salarySource: SalarySource = 'none'
  let currencyAmbiguous = false
  const now = new Date()

  // Try Greenhouse-specific parsing first (more accurate)
  if (salaryMin === null && salaryMax === null && input.source === 'ats:greenhouse') {
    const html = input.descriptionHtml ?? ''
    const greenhouseSalary = parseGreenhouseSalary(html)
    if (greenhouseSalary) {
      salaryMin = greenhouseSalary.min
      salaryMax = greenhouseSalary.max
      salaryCurrency = greenhouseSalary.currency
      salaryInterval = 'year'
      salarySource = 'descriptionText'
      if (!greenhouseSalary.currency) currencyAmbiguous = true
    }
  }

  // ATS structured salary
  if (
    salarySource === 'none' &&
    (input.salaryMin != null || input.salaryMax != null) &&
    input.salaryCurrency != null
  ) {
    salarySource = 'ats'
    if (String(input.salaryCurrency).trim() === '$') currencyAmbiguous = true
  }

  // Fallback: Try parsing from text if no explicit values
  if (salaryMin === null && salaryMax === null) {
    const salaryRawText: string = input.salaryRaw ?? ''
    const descText: string = input.descriptionText ?? input.descriptionHtml ?? ''
    const textToParse: string = salaryRawText || descText

    if (textToParse.length > 0) {
      const parsed = parseSalaryFromText(textToParse)
      if (parsed) {
        salaryMin = parsed.min
        salaryMax = parsed.max
        salaryCurrency = parsed.currency
        salaryInterval = parsed.interval ?? 'year'
        salarySource = salaryRawText ? 'salaryRaw' : 'descriptionText'
      }
    }
  }

  // Normalize salary
  const normalized = normalizeSalary({
    min: salaryMin,
    max: salaryMax,
    currency: salaryCurrency,
    interval: salaryInterval,
  })

  const validation = validateHighSalaryEligibility({
    normalized,
    source: salarySource,
    currencyAmbiguous,
    now,
  })

  return {
    salaryMin: salaryMin !== null ? BigInt(Math.round(salaryMin)) : null,
    salaryMax: salaryMax !== null ? BigInt(Math.round(salaryMax)) : null,
    salaryCurrency,
    salaryInterval,
    minAnnual: normalized.minAnnual,
    maxAnnual: normalized.maxAnnual,
    currency: normalized.currency,
    isHighSalary: validation.salaryValidated === true,
    ...validation,
  }
}

const BANNED_TITLE_RE =
  /\b(junior|jr\.?|entry[- ]level|intern|internship|graduate|new\s*grad|new\s*graduate)\b/i
const BANNED_TYPE_RE = /\b(part[- ]time|contract|temporary)\b/i

function getStrictExclusionReason(
  title: string | null | undefined,
  employmentType: string | null | undefined
): string | null {
  const t = String(title ?? '')
  if (BANNED_TITLE_RE.test(t)) return 'banned-title'

  const type = String(employmentType ?? '')
  if (BANNED_TYPE_RE.test(type) || BANNED_TYPE_RE.test(t)) return 'banned-employment-type'

  return null
}

function inferExperienceLevelFromTitle(title: string | null | undefined): string {
  const t = ` ${String(title ?? '').toLowerCase()} `

  if (/\b(principal)\b/.test(t)) return 'principal'
  if (/\b(staff)\b/.test(t)) return 'staff'
  if (/\b(senior|sr\.?)\b/.test(t)) return 'senior'
  if (/\b(lead)\b/.test(t)) return 'lead'
  if (/\b(director)\b/.test(t)) return 'director'
  if (/\b(vp|vice president)\b/.test(t)) return 'vp'
  if (/\b(chief|cto|ceo|cpo|coo|ciso|cio)\b/.test(t)) return 'c-level'

  return 'mid'
}

function processLocation(input: ScrapedJobInput) {
  const locationText = input.locationText || ''
  const location = normalizeLocationData(locationText)

  let remoteMode: string | null = null
  const effectiveRemote = input.isRemote || location.isRemote || false

  if (effectiveRemote) {
    remoteMode = 'remote'
  } else if (location.kind === 'hybrid') {
    remoteMode = 'hybrid'
  } else if (location.kind === 'onsite') {
    remoteMode = 'onsite'
  } else if (location.city || location.country) {
    remoteMode = 'onsite'
  }

  const countryCode = countryToCode(location.country)

  return {
    city: location.city ?? null,
    citySlug: location.city ? slugify(location.city, { lower: true, strict: true }) : null,
    countryCode,
    isRemote: effectiveRemote,
    remoteMode,
  }
}

function countryToCode(country: string | null | undefined): string | null {
  if (!country) return null

  const map: Record<string, string> = {
    'united states': 'US',
    'united kingdom': 'GB',
    'canada': 'CA',
    'germany': 'DE',
    'france': 'FR',
    'netherlands': 'NL',
    'spain': 'ES',
    'italy': 'IT',
    'australia': 'AU',
    'new zealand': 'NZ',
    'sweden': 'SE',
    'norway': 'NO',
    'denmark': 'DK',
    'finland': 'FI',
    'switzerland': 'CH',
    'ireland': 'IE',
    'poland': 'PL',
    'portugal': 'PT',
    'brazil': 'BR',
    'mexico': 'MX',
    'india': 'IN',
    'singapore': 'SG',
  }

  return map[country.toLowerCase()] ?? null
}

/**
 * Check if a board job should be marked as "unverified"
 * (company has ATS, was scraped recently, but this job doesn't appear in ATS)
 */
async function checkUnverifiedBoardJob(
  company: ResolvedCompany,
  input: ScrapedJobInput,
  dedupeKey: string
): Promise<boolean> {
  // Only applies to board sources
  if (!isBoardSource(input.source)) {
    return false
  }

  // Company must have an ATS configured
  if (!company.atsProvider) {
    return false
  }

  // ATS must have been scraped recently
  if (!company.lastScrapedAt) {
    return false
  }

  const daysSinceAtsScrape = (Date.now() - company.lastScrapedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceAtsScrape > ATS_RECENT_DAYS) {
    return false
  }

  // Check if any ATS job exists with the same dedupe key
  const atsJobExists = await prisma.job.findFirst({
    where: {
      companyId: company.id,
      dedupeKey,
      source: { startsWith: 'ats:' },
      isExpired: false,
    },
  })

  // If no ATS job with same key, this board job is "unverified"
  return !atsJobExists
}

// =============================================================================
// Batch Ingestion Helper
// =============================================================================

/**
 * Ingest multiple jobs and return aggregated stats.
 */
export async function ingestJobs(jobs: ScrapedJobInput[]): Promise<IngestStats> {
  const stats: IngestStats = {
    created: 0,
    updated: 0,
    upgraded: 0,
    skipped: 0,
    errors: 0,
  }

  for (const job of jobs) {
    const result = await ingestJob(job)

    switch (result.status) {
      case 'created':
        stats.created++
        break
      case 'updated':
        stats.updated++
        break
      case 'upgraded':
        stats.upgraded++
        break
      case 'skipped':
        stats.skipped++
        break
      case 'error':
        stats.errors++
        break
    }
  }

  return stats
}

// =============================================================================
// Exports
// =============================================================================

export { createEmptyStats, mergeStats } from './types'
export type { ScrapedJobInput, IngestResult, IngestStats } from './types'
