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
  estimateUsdAnnualFromNormalized,
  type SalarySource,
} from '../normalizers/salary'
import { normalizeLocation as normalizeLocationData } from '../normalizers/location'
import { normalizeRole } from '../normalizers/role'
import slugify from 'slugify'
import { parseGreenhouseSalary } from './greenhouseSalaryParser'
import { getShortStableIdForJobId } from '../jobs/jobSlug'

import { getSourcePriority, isAtsSource, isBoardSource } from './sourcePriority'
import { makeJobDedupeKey, normalizeUrl } from './dedupeHelpers'
import type { ScrapedJobInput, IngestResult, IngestStats, ResolvedCompany } from './types'
import { isValidScrapedJob, getValidationErrors } from './types'

function safeUrlsMatch(urlA: string | null | undefined, urlB: string | null | undefined): boolean {
  if (!urlA || !urlB) return false
  if (urlA === urlB) return true

  const normA = normalizeUrl(urlA)
  const normB = normalizeUrl(urlB)
  if (!normA || !normB || normA !== normB) return false

  try {
    const a = new URL(urlA)
    const b = new URL(urlB)

    const aPath = a.pathname.replace(/\/$/, '')
    const pathSegments = aPath.split('/').filter(Boolean)
    const pathLooksSpecific = /\d/.test(aPath) || pathSegments.length >= 3

    // If the path is too generic, avoid treating different query strings as the same job.
    if (!pathLooksSpecific && a.search !== b.search) return false
  } catch {
    // If parsing fails, fall back to normalized comparison.
  }

  return true
}

// =============================================================================
// Configuration
// =============================================================================

/** How many days back to consider a company's ATS scrape as "recent" */
const ATS_RECENT_DAYS = 7

const shouldLogIngest = process.env.NODE_ENV !== 'production' || process.env.DEBUG_INGEST === '1'
const ingestLog = (...args: Parameters<typeof console.log>) => {
  if (shouldLogIngest) console.log(...args)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function retryPrismaWrite<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: any
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      const code = err?.code

      // Prisma recommends retrying on transaction conflicts/deadlocks.
      // Also retry transient connection pool issues.
      const retryable =
        code === 'P2034' || // transaction write conflict / deadlock
        code === 'P2024' || // connection pool timeout
        code === 'P1001' || // can't reach database
        code === 'P1002' // database timeout

      if (!retryable || attempt === 3) throw err

      const backoffMs = 100 * 2 ** (attempt - 1)
      ingestLog(`[ingest] retrying ${label} (attempt ${attempt + 1}/3) after ${backoffMs}ms`, code)
      await sleep(backoffMs)
    }
  }

  throw lastErr
}

// =============================================================================
// Main Ingest Function
// =============================================================================

/**
 * Ingest a scraped job into the database.
 * This function handles:
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
    console.warn(
      `[ingest] Invalid job input: ${errors.join(', ')}`,
      (input as any).title ?? 'unknown',
    )
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

    // 5. Also look for existing job by URL (fallback matching).
    // IMPORTANT: we normalize URLs to avoid duplicates caused by trailing slashes / query params / minor formatting differences.
    const existingByUrl =
      input.url || input.applyUrl
        ? (
            await prisma.job.findMany({
              where: {
                companyId: company.id,
                source: input.source,
                title: { equals: input.title, mode: 'insensitive' },
                isExpired: false,
              },
              select: {
                id: true,
                source: true,
                url: true,
                applyUrl: true,
                sourcePriority: true,
                dedupeKey: true,
              },
            })
          ).find(
            (j) =>
              safeUrlsMatch(j.url, input.url) ||
              safeUrlsMatch(j.applyUrl, input.applyUrl) ||
              safeUrlsMatch(j.url, input.applyUrl) ||
              safeUrlsMatch(j.applyUrl, input.url),
          ) ?? null
        : null

    // 5b. Guardrail: if companyId-based matching fails, fall back to title + company + source.
    // This prevents duplicates when company resolution or URL formatting differs across runs.
    const existingByTitleCompanySource =
      !existingByKey && !existingByUrl
        ? (
            await prisma.job.findMany({
              where: {
                company: { equals: company.name, mode: 'insensitive' },
                source: input.source,
                title: { equals: input.title, mode: 'insensitive' },
                isExpired: false,
              },
              select: {
                id: true,
                source: true,
                url: true,
                applyUrl: true,
                sourcePriority: true,
                dedupeKey: true,
              },
            })
          ).find(
            (j) =>
              safeUrlsMatch(j.url, input.url) ||
              safeUrlsMatch(j.applyUrl, input.applyUrl) ||
              safeUrlsMatch(j.url, input.applyUrl) ||
              safeUrlsMatch(j.applyUrl, input.url),
          ) ?? null
        : null

    // 5c. Stable-id fallback: if we still can't match, use the deterministic job id (source + externalId).
    // This prevents "missed match -> create -> P2002" churn when titles or company resolution changes slightly.
    const stableJobId = buildJobId(input.source, input.externalId)
    const existingById = await prisma.job.findUnique({
      where: { id: stableJobId },
    })

    // Use whichever match we found (prefer dedupe key match)
    const existing = existingByKey || existingByUrl || existingByTitleCompanySource || existingById

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
  const company = await upsertCompanyFromBoard({
    rawName: input.rawCompanyName,
    source: input.source,
    websiteUrl: input.companyWebsiteUrl ?? null,
    linkedinUrl: input.companyLinkedInUrl ?? null,
    applyUrl: input.applyUrl ?? input.url ?? null,
    explicitAtsProvider: input.explicitAtsProvider ?? null,
    explicitAtsUrl: input.explicitAtsUrl ?? null,
  })

  if (!company) return null

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
  priority: number,
): Promise<IngestResult> {
  // ✅ Remote defaults: prevent empty location objects + enforce remote tagging
  // MUST be at the very top of the job-mutation path (before parsing/gating)
  if (input.isRemote === true && !input.locationText) input.locationText = 'Remote'
  if (input.isRemote === true && !input.remoteRegion) input.remoteRegion = 'Global'

  // Build job ID
  const jobId = buildJobId(input.source, input.externalId)

  const strictExclusionReason = getStrictExclusionReason(input.title, input.employmentType)
  if (strictExclusionReason) {
    return { status: 'skipped', reason: strictExclusionReason, dedupeKey }
  }

  // Process salary
  const salaryData = processSalary(input)
  if (salaryData.salaryValidated !== true) {
    return { status: 'skipped', reason: 'salary-not-eligible', dedupeKey }
  }

  // Process location (FIXED: hybrid/onsite must win over isRemote)
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
    needsReview: salaryData.needsReview,

    // Job details
    type: input.employmentType ?? 'Full-time',
    employmentType: input.employmentType ?? null,
    experienceLevel: inferExperienceLevelFromTitle(input.title),
    applyUrl: input.applyUrl ?? input.url ?? null,
    url: input.url ?? null,
    descriptionHtml: input.descriptionHtml ?? null,

    // v2.7+: never write NULL roleSlug (breaks routing/sitemaps); fallback to "other"
    roleSlug: roleData.roleSlug || 'other',

    // Tracking
    externalId: input.externalId,
    isExpired: false,
    lastSeenAt: new Date(),
    postedAt: input.postedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  try {
    // Use an atomic upsert to avoid race-condition PK collisions when multiple
    // concurrent ingests attempt to create the same deterministic job id.
    await retryPrismaWrite('job.upsert', async () =>
      prisma.job.upsert({
        where: { id: jobId },
        create: jobData,
        update: {
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    )

    return { status: 'created', jobId, dedupeKey }
  } catch (error: any) {
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
      // Other unique constraint collisions should remain visible.
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
  priority: number,
): Promise<IngestResult> {
  // ✅ Remote defaults: prevent empty location objects + enforce remote tagging
  // MUST be at the very top of the job-mutation path (before parsing/gating)
  if (input.isRemote === true && !input.locationText) input.locationText = 'Remote'
  if (input.isRemote === true && !input.remoteRegion) input.remoteRegion = 'Global'

  // ✅ IMPORTANT: prevent “contract/part-time” leakage when incoming payload omits employmentType
  const effectiveEmploymentType =
    input.employmentType ?? existing.employmentType ?? existing.type

  const strictExclusionReason = getStrictExclusionReason(input.title, effectiveEmploymentType)
  if (strictExclusionReason) {
    return { status: 'skipped', reason: strictExclusionReason, jobId: existing.id, dedupeKey }
  }

  // Process salary
  const salaryData = processSalary(input)
  if (salaryData.salaryValidated !== true) {
    return { status: 'skipped', reason: 'salary-not-eligible', jobId: existing.id, dedupeKey }
  }

  // Process location (FIXED: hybrid/onsite must win over isRemote)
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

    // Update title
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
    isHundredKLocal: false,

    // Salary quality (v2.9)
    salaryValidated: salaryData.salaryValidated,
    salaryConfidence: salaryData.salaryConfidence,
    salarySource: salaryData.salarySource,
    salaryParseReason: salaryData.salaryParseReason,
    salaryNormalizedAt: salaryData.salaryNormalizedAt,
    salaryRejectedAt: salaryData.salaryRejectedAt,
    salaryRejectedReason: salaryData.salaryRejectedReason,
    needsReview: salaryData.needsReview,

    // ✅ Force type fields to update (prevents old “Contract” from lingering)
    type: input.employmentType ?? existing.type,
    employmentType: input.employmentType ?? existing.employmentType,

    // URLs
    applyUrl: input.applyUrl ?? input.url ?? existing.applyUrl,
    url: input.url ?? existing.url,
    descriptionHtml: input.descriptionHtml ?? existing.descriptionHtml,

    // Role (never NULL)
    roleSlug: roleData.roleSlug || 'other',

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

  ingestLog(`[ingest] Upgraded job ${existing.id} from ${existing.source} to ${input.source}`)

  return { status: 'upgraded', jobId: existing.id, dedupeKey }
}

// =============================================================================
// Job Refresh (same priority, update minor fields)
// =============================================================================

async function refreshJob(existing: any, input: ScrapedJobInput): Promise<IngestResult> {
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
      updateData.needsReview = salaryData.needsReview
    }
  }

  // Fill in missing logo
  if (!existing.companyLogo && input.companyLogoUrl) {
    updateData.companyLogo = input.companyLogoUrl
  }

  // Update applyUrl if we previously fell back to the board URL (or had none).
  // This lets board scrapers "upgrade" applyUrl once we can resolve an external/mailto destination.
  if (input.applyUrl && input.applyUrl !== existing.applyUrl) {
    const existingApply = existing.applyUrl || ''
    const existingUrl = existing.url || ''
    const shouldUpgradeApplyUrl =
      !existingApply ||
      (existingUrl && existingApply === existingUrl) ||
      (() => {
        try {
          const hostA = new URL(existingApply).hostname.replace(/^www\./, '').toLowerCase()
          const hostB = new URL(existingUrl).hostname.replace(/^www\./, '').toLowerCase()
          return hostA === hostB
        } catch {
          return false
        }
      })()

    if (shouldUpgradeApplyUrl) {
      updateData.applyUrl = input.applyUrl
    }
  }

  await prisma.job.update({
    where: { id: existing.id },
    data: updateData,
  })

  return { status: 'updated', jobId: existing.id, dedupeKey: existing.dedupeKey }
}

// =============================================================================
// Helper Functions
// =============================================================================

function buildJobId(source: string, externalId: string): string {
  const safeExternalId = externalId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200)
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
    const greenhouseSalary = parseGreenhouseSalary({
      html,
      locationText: input.locationText ?? null,
      countryCode: null,
    })
    if (greenhouseSalary) {
      salaryMin = greenhouseSalary.min
      salaryMax = greenhouseSalary.max
      salaryCurrency = greenhouseSalary.currency
      salaryInterval = greenhouseSalary.interval ?? 'year'
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

  const usdAnnual = estimateUsdAnnualFromNormalized(normalized)
  const needsReview =
    validation.salaryValidated === true &&
    usdAnnual != null &&
    usdAnnual > 600_000 &&
    usdAnnual < 2_000_000

  return {
    salaryMin: salaryMin !== null ? BigInt(Math.round(salaryMin)) : null,
    salaryMax: salaryMax !== null ? BigInt(Math.round(salaryMax)) : null,
    salaryCurrency,
    salaryInterval,
    minAnnual: normalized.minAnnual,
    maxAnnual: normalized.maxAnnual,
    currency: normalized.currency,
    isHighSalary: validation.salaryValidated === true,
    needsReview,
    ...validation,
  }
}

const BANNED_TITLE_RE =
  /\b(junior|jr\.?|entry[- ]level|intern|internship|graduate|new\s*grad|new\s*graduate)\b/i
const BANNED_TYPE_RE = /\b(part[- ]time|contract|temporary)\b/i

function getStrictExclusionReason(
  title: string | null | undefined,
  employmentType: string | null | undefined,
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

/**
 * Location normalization (v2.9):
 * - If normalizer says "hybrid" → remote=false, remoteMode='hybrid' (wins)
 * - If normalizer says "onsite" → remote=false, remoteMode='onsite' (wins)
 * - Only then consider true remote via input.isRemote or location.isRemote
 */
function processLocation(input: ScrapedJobInput) {
  const locationText = input.locationText || ''
  const location = normalizeLocationData(locationText)
  const countryCode = countryToCode(location.country)

  // ✅ Hybrid / Onsite must win over any “isRemote” heuristic
  if (location.kind === 'hybrid') {
    return {
      city: location.city ?? null,
      citySlug: location.city ? slugify(location.city, { lower: true, strict: true }) : null,
      countryCode,
      isRemote: false,
      remoteMode: 'hybrid',
    }
  }

  if (location.kind === 'onsite') {
    return {
      city: location.city ?? null,
      citySlug: location.city ? slugify(location.city, { lower: true, strict: true }) : null,
      countryCode,
      isRemote: false,
      remoteMode: 'onsite',
    }
  }

  // True remote only
  const effectiveRemote = input.isRemote === true || location.isRemote === true

  return {
    city: location.city ?? null,
    citySlug: location.city ? slugify(location.city, { lower: true, strict: true }) : null,
    countryCode,
    isRemote: effectiveRemote,
    remoteMode: effectiveRemote ? 'remote' : location.city || location.country ? 'onsite' : null,
  }
}

function countryToCode(country: string | null | undefined): string | null {
  if (!country) return null

  const map: Record<string, string> = {
    'united states': 'US',
    'united kingdom': 'GB',
    canada: 'CA',
    germany: 'DE',
    france: 'FR',
    netherlands: 'NL',
    spain: 'ES',
    italy: 'IT',
    australia: 'AU',
    'new zealand': 'NZ',
    sweden: 'SE',
    norway: 'NO',
    denmark: 'DK',
    finland: 'FI',
    switzerland: 'CH',
    ireland: 'IE',
    poland: 'PL',
    portugal: 'PT',
    brazil: 'BR',
    mexico: 'MX',
    india: 'IN',
    singapore: 'SG',
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
  dedupeKey: string,
): Promise<boolean> {
  if (!isBoardSource(input.source)) return false
  if (!company.atsProvider) return false
  if (!company.lastScrapedAt) return false

  const daysSinceAtsScrape =
    (Date.now() - company.lastScrapedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceAtsScrape > ATS_RECENT_DAYS) return false

  const atsJobExists = await prisma.job.findFirst({
    where: {
      companyId: company.id,
      dedupeKey,
      source: { startsWith: 'ats:' },
      isExpired: false,
    },
  })

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
// Exports (match your current exports)
// =============================================================================

export { createEmptyStats, mergeStats } from './types'
export type { ScrapedJobInput, IngestResult, IngestStats } from './types'
