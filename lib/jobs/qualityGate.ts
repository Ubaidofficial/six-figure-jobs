import type { Prisma } from '@prisma/client'
import { getHighSalaryThresholdAnnual } from '../currency/thresholds'

export const QUALITY_MIN_DESCRIPTION_CHARS = 140
export const QUALITY_MIN_AI_SNIPPET_CHARS = 80
export const QUALITY_MIN_AI_ONE_LINER_CHARS = 24
export const QUALITY_MIN_SALARY_CONFIDENCE = 80

export type JobIndexabilityInput = {
  id?: string | null
  externalId?: string | null
  title?: string | null
  roleSlug?: string | null
  company?: string | null
  companyId?: string | null
  locationRaw?: string | null
  citySlug?: string | null
  countryCode?: string | null
  remote?: boolean | null
  remoteMode?: string | null
  descriptionHtml?: string | null
  aiSnippet?: string | null
  aiOneLiner?: string | null
  salaryValidated?: boolean | null
  salaryConfidence?: number | bigint | string | null
  minAnnual?: number | bigint | string | null
  maxAnnual?: number | bigint | string | null
  currency?: string | null
  isExpired?: boolean | null
  postedAt?: Date | string | null
  updatedAt?: Date | string | null
}

export type JobIndexabilityResult = {
  indexable: boolean
  reason: string
}

export type JobForIndexabilityDedupe = JobIndexabilityInput

function fail(reason: string): JobIndexabilityResult {
  return { indexable: false, reason }
}

function toNumber(value: number | bigint | string | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }

  const n = Number(String(value).trim())
  return Number.isFinite(n) ? n : null
}

function toPlainText(html: string | null | undefined): string {
  const raw = String(html || '')
  if (!raw) return ''

  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeForFingerprint(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateKey(value: Date | string | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''
  return date.toISOString().slice(0, 10)
}

function toTimestamp(value: Date | string | null | undefined): number {
  const date = toDate(value)
  if (!date) return 0
  return date.getTime()
}

export function buildIndexableJobStructureWhere(): Prisma.JobWhereInput {
  return {
    title: { not: '' },
    company: { not: '' },
    AND: [
      {
        OR: [
          { remote: true },
          { remoteMode: { in: ['remote', 'hybrid', 'onsite'] } },
          { locationRaw: { not: null } },
          { citySlug: { not: null } },
          { countryCode: { not: null } },
        ],
      },
      {
        OR: [
          { descriptionHtml: { not: null } },
          { aiSnippet: { not: null } },
          { aiOneLiner: { not: null } },
        ],
      },
      {
        OR: [
          { minAnnual: { not: null } },
          { maxAnnual: { not: null } },
        ],
      },
      { currency: { not: null } },
    ],
  }
}

export function evaluateJobIndexability(job: JobIndexabilityInput): JobIndexabilityResult {
  if (!job) return fail('missing_job')

  if (job.isExpired === true) return fail('expired')
  if (!job.id || !String(job.id).trim()) return fail('missing_id')

  const title = String(job.title || '').trim()
  if (title.length < 3) return fail('missing_title')

  const companyName = String(job.company || '').trim()
  const companyId = String(job.companyId || '').trim()
  if (!companyName && !companyId) return fail('missing_company')

  const hasLocationSignal =
    job.remote === true ||
    (typeof job.remoteMode === 'string' && job.remoteMode.trim().length > 0) ||
    Boolean(String(job.locationRaw || '').trim()) ||
    Boolean(String(job.citySlug || '').trim()) ||
    Boolean(String(job.countryCode || '').trim())

  if (!hasLocationSignal) return fail('missing_location')

  if (job.salaryValidated !== true) return fail('salary_not_validated')

  const confidence = toNumber(job.salaryConfidence)
  if (confidence == null || confidence < QUALITY_MIN_SALARY_CONFIDENCE) {
    return fail('salary_low_confidence')
  }

  const currency = String(job.currency || '').trim().toUpperCase()
  const threshold = getHighSalaryThresholdAnnual(currency)
  if (threshold == null) return fail('unsupported_currency')

  const minAnnual = toNumber(job.minAnnual)
  const maxAnnual = toNumber(job.maxAnnual)
  // Range pass rule:
  // - If either end of the normalized annual range meets the local threshold,
  //   the job is treated as salary-eligible.
  const annual = Math.max(minAnnual ?? 0, maxAnnual ?? 0)
  if (!Number.isFinite(annual) || annual < threshold) {
    return fail('below_threshold')
  }

  const descriptionLen = toPlainText(job.descriptionHtml).length
  const aiSnippetLen = String(job.aiSnippet || '').trim().length
  const aiOneLinerLen = String(job.aiOneLiner || '').trim().length

  const hasEnoughContent =
    descriptionLen >= QUALITY_MIN_DESCRIPTION_CHARS ||
    aiSnippetLen >= QUALITY_MIN_AI_SNIPPET_CHARS ||
    aiOneLinerLen >= QUALITY_MIN_AI_ONE_LINER_CHARS

  if (!hasEnoughContent) return fail('thin_content')

  return {
    indexable: true,
    reason: 'ok',
  }
}

export function buildIndexabilityFingerprint(job: JobForIndexabilityDedupe): string {
  const companyKey = normalizeForFingerprint(job.companyId || job.company || '')
  const titleKey = normalizeForFingerprint(job.title)
  const roleKey = normalizeForFingerprint(job.roleSlug)
  const locationKey = normalizeForFingerprint(
    [
      job.remote === true ? 'remote' : '',
      job.remoteMode || '',
      job.citySlug || '',
      job.countryCode || '',
      job.locationRaw || '',
    ]
      .filter(Boolean)
      .join(' '),
  )
  const postedDay = toDateKey(job.postedAt)

  const primary = [companyKey, titleKey, roleKey, locationKey, postedDay]
    .filter(Boolean)
    .join('|')
  if (primary) return primary

  // Last-resort fallback when structured fields are missing.
  return normalizeForFingerprint(job.id || job.externalId || '')
}

export function dedupeIndexableJobs<T extends JobForIndexabilityDedupe>(jobs: T[]): T[] {
  const byFingerprint = new Map<string, T>()

  for (const job of jobs) {
    const fingerprint = buildIndexabilityFingerprint(job)
    const existing = byFingerprint.get(fingerprint)
    if (!existing) {
      byFingerprint.set(fingerprint, job)
      continue
    }

    // Prefer freshest record when near-duplicates collide.
    const incomingUpdated = toTimestamp(job.updatedAt)
    const existingUpdated = toTimestamp(existing.updatedAt)
    if (incomingUpdated > existingUpdated) {
      byFingerprint.set(fingerprint, job)
      continue
    }

    if (incomingUpdated === existingUpdated) {
      const incomingId = String(job.id || '')
      const existingId = String(existing.id || '')
      if (incomingId > existingId) {
        byFingerprint.set(fingerprint, job)
      }
    }
  }

  return Array.from(byFingerprint.values())
}
