// lib/jobs/ingestFromAts.ts
// Wrapper for ingesting jobs from ATS (Greenhouse, Lever, Ashby, Workday)
//
// This uses the central ingest function but preserves ATS-specific logic:
// - Role slug inference from title
// - Salary extraction from HTML
// - Specific job ID format
//
// NOTE: Company must already exist (created by board scrapers or seed scripts).

import { ingestJob } from '../ingest'
import { makeAtsSource } from '../ingest/sourcePriority'
import type { ScrapedJobInput } from '../ingest/types'

// =============================================================================
// Types
// =============================================================================

export type UpsertAtsResult = {
  created: number
  updated: number
  skipped: number
  companyId?: string | null
  companySlug?: string | null
  totalJobs?: number
}

// =============================================================================
// Helpers (preserved from original)
// =============================================================================

function slugify(input: string | null | undefined): string | null {
  if (!input) return null
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim() || null
  )
}

function inferRoleSlugFromTitle(title: string | null | undefined): string | null {
  if (!title) return null
  const t = title.toLowerCase()

  // Order matters: more specific first
  if (t.includes('machine learning') || t.includes('ml engineer')) {
    return 'ml-engineer'
  }
  if (t.includes('data scientist')) {
    return 'data-scientist'
  }
  if (t.includes('ai engineer') || t.includes('artificial intelligence')) {
    return 'ai-engineer'
  }
  if (t.includes('backend') || t.includes('back-end')) {
    return 'backend-engineer'
  }
  if (t.includes('frontend') || t.includes('front-end')) {
    return 'frontend-engineer'
  }
  if (t.includes('full stack') || t.includes('full-stack')) {
    return 'full-stack-engineer'
  }
  if (t.includes('software engineer') || t.includes('software developer')) {
    return 'software-engineer'
  }
  if (t.includes('product manager')) {
    return 'product-manager'
  }
  if (t.includes('designer')) {
    return 'designer'
  }
  if (t.includes('devops') || t.includes('site reliability') || t.includes('sre')) {
    return 'devops-engineer'
  }
  if (t.includes('data engineer')) {
    return 'data-engineer'
  }
  if (t.includes('security engineer')) {
    return 'security-engineer'
  }

  // Fallback: slugify the raw title so at least slice pages can exist
  return slugify(title)
}

// =============================================================================
// Salary Parsing (preserved from original)
// =============================================================================

type SalaryInfo = {
  minAnnual?: bigint | null
  maxAnnual?: bigint | null
  currency?: string | null
  isHundredKLocal?: boolean
  salaryRaw?: string | null
  salaryMin?: bigint | null
  salaryMax?: bigint | null
  salaryCurrency?: string | null
  salaryPeriod?: string | null
}

function extractSalaryFromHtml(html?: string | null): SalaryInfo {
  if (!html) return {}

  let decoded = html
  // If it looks like HTML has been entity-escaped, decode a few basics
  if (!/<\w+/i.test(html) && /&lt;\/?\w+/i.test(html)) {
    decoded = decodeEntities(html)
  }

  const salaryRaw = html
  const text = stripTags(decoded)

  let numbers: number[] = []

  // $120,000 style
  const commaMatches = text.match(/\$ ?([0-9]{2,3}(?:,[0-9]{3})*)/g)
  if (commaMatches && commaMatches.length > 0) {
    numbers = commaMatches
      .map((m) => m.replace(/[^0-9]/g, ''))
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
  }

  // 120k style
  if (!numbers.length) {
    const kMatches = text.match(/\$ ?([0-9]{2,3})\s*k/gi)
    if (kMatches && kMatches.length > 0) {
      numbers = kMatches
        .map((m) => m.replace(/[^0-9]/g, ''))
        .map((n) => Number(n) * 1000)
        .filter((n) => Number.isFinite(n))
    }
  }

  if (!numbers.length) {
    return { salaryRaw }
  }

  let min = numbers[0]
  let max = numbers[0]

  if (numbers.length >= 2) {
    min = Math.min(numbers[0], numbers[1])
    max = Math.max(numbers[0], numbers[1])
  }

  const minAnnual = BigInt(min)
  const maxAnnual = BigInt(max)
  const isHundredKLocal = max >= 100_000 || min >= 100_000

  return {
    minAnnual,
    maxAnnual,
    currency: 'USD',
    salaryRaw,
    isHundredKLocal,
    salaryMin: minAnnual,
    salaryMax: maxAnnual,
    salaryCurrency: 'USD',
    salaryPeriod: 'year',
  }
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripTags(str: string): string {
  return str.replace(/<\/?[^>]+(>|$)/g, '')
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Ingest jobs for a single company from ATS.
 *
 * IMPORTANT:
 * - We assume the Company row already exists (created by board scrapers).
 * - We do NOT create or rename companies here.
 * - Only inserts/updates Job rows via the central ingest.
 */
export async function upsertJobsForCompanyFromAts(
  company: any,
  rawJobs: any[],
): Promise<UpsertAtsResult> {
  if (!company || !company.id || !Array.isArray(rawJobs) || rawJobs.length === 0) {
    console.log('[ATS ingest] No company or jobs to ingest')
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      companyId: company?.id ?? null,
      companySlug: company?.slug ?? null,
      totalJobs: rawJobs?.length ?? 0,
    }
  }

  const companyId: string = company.id
  const companySlug: string | null = company.slug ?? null
  const companyName: string = company.name ?? 'Unknown company'
  const companyLogo: string | null = company.logoUrl ?? null
  const atsProvider: string = company.atsProvider ?? 'unknown'

  let created = 0
  let updated = 0
  let skipped = 0

  for (const raw of rawJobs) {
    try {
      // Extract external ID
      const externalId: string | null =
        (raw.externalId as string) ?? (raw.id != null ? String(raw.id) : null)

      if (!externalId) {
        skipped++
        continue
      }

      const title: string = raw.title || 'Unknown role'

      // Build location text
      const locationText: string | null =
        raw.locationText ?? raw.location?.name ?? raw.location ?? null

      // Check if remote
      const isRemote: boolean =
        raw.remote === true ||
        (locationText?.toLowerCase().includes('remote') ?? false)

      // Get URLs
      const jobUrl: string | null = raw.url ?? raw.absolute_url ?? null
      const applyUrl: string | null = raw.applyUrl ?? raw.absolute_url ?? jobUrl

      // Get description (Greenhouse uses 'content', others use 'description')
      const descriptionHtml: string | null =
        raw.descriptionHtml ?? raw.description ?? raw.content ?? null

      // Parse salary from HTML using our preserved function
      const salarySourceHtml: string | null =
        raw.salaryHtml ?? raw.salaryRaw ?? raw.salary ?? descriptionHtml ?? null
      const salary = extractSalaryFromHtml(salarySourceHtml)

      // Get timestamps
      const postedAt: Date | null = raw.postedAt
        ? new Date(raw.postedAt)
        : raw.updated_at
        ? new Date(raw.updated_at)
        : null

      // Infer role slug from title
      const inferredRoleSlug = raw.roleSlug ?? inferRoleSlugFromTitle(title)

      // Build ScrapedJobInput
      const scrapedJob: ScrapedJobInput = {
        // Required fields
        externalId,
        title,
        source: makeAtsSource(atsProvider),

        // Company info (already resolved)
        rawCompanyName: companyName,
        companyLogoUrl: companyLogo,

        // URLs
        url: jobUrl,
        applyUrl: applyUrl ?? jobUrl,

        // Location
        locationText,
        isRemote,

        // Salary - use our extracted values
        salaryRaw: salary.salaryRaw ?? null,
        salaryMin: salary.salaryMin ? Number(salary.salaryMin) : null,
        salaryMax: salary.salaryMax ? Number(salary.salaryMax) : null,
        salaryCurrency: salary.salaryCurrency ?? null,
        salaryInterval: salary.salaryPeriod ?? 'year',

        // Job details
        employmentType: raw.type ?? raw.employmentType ?? null,
        department: raw.department ?? null,
        descriptionHtml,
        descriptionText: null,

        // Timestamps
        postedAt,
        updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,

        // Raw data for debugging
        raw: {
          ...raw,
          // Include inferred role slug in raw for potential use
          _inferredRoleSlug: inferredRoleSlug,
        },
      }

      // Delegate to central ingest
      const result = await ingestJob(scrapedJob)

      // Track stats
      switch (result.status) {
        case 'created':
          created++
          break
        case 'updated':
        case 'upgraded':
          updated++
          break
        case 'skipped':
        case 'error':
        default:
          skipped++
          break
      }
    } catch (err) {
      console.error('[ATS ingest] Failed to upsert job:', err)
      skipped++
    }
  }

  console.log(
    `[ATS ingest] ${companySlug ?? companyId} → created=${created}, updated=${updated}, skipped=${skipped}`,
  )

  return {
    created,
    updated,
    skipped,
    companyId,
    companySlug,
    totalJobs: rawJobs.length,
  }
}