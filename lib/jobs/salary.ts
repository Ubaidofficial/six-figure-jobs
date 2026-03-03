import { formatSalaryRange } from "../normalizers/salary"
// lib/jobs/salary.ts
// Unified salary helpers for JobCard, JobPage, CompanyPage, Slices, SEO, etc.

export type SalaryJob = {
  minAnnual?: number | bigint | null
  maxAnnual?: number | bigint | null
  currency?: string | null
  salaryMin?: number | bigint | null
  salaryMax?: number | bigint | null
  salaryCurrency?: string | null
  salaryRaw?: string | null
  countryCode?: string | null
  remote?: boolean | null
  remoteMode?: string | null
}

/* -------------------------------------------------------------
   Currency symbols
------------------------------------------------------------- */
function getCurrencySymbol(code?: string | null) {
  if (!code) return '$'
  const c = code.toUpperCase()

  switch (c) {
    case 'USD':
      return '$'
    case 'EUR':
      return '€'
    case 'GBP':
      return '£'
    case 'AUD':
      return 'A$'
    case 'CAD':
      return 'C$'
    case 'SGD':
      return 'S$'
    case 'JPY':
      return '¥'
    case 'INR':
      return '₹'
    case 'CHF':
      return 'CHF '
    case 'NZD':
      return 'NZ$'
    default:
      return `${c} `
  }
}

function currencyForCountry(code?: string | null): string | null {
  if (!code) return null
  const c = code.toUpperCase()
  const map: Record<string, string> = {
    US: 'USD',
    CA: 'CAD',
    GB: 'GBP',
    UK: 'GBP',
    IE: 'EUR',
    DE: 'EUR',
    FR: 'EUR',
    ES: 'EUR',
    IT: 'EUR',
    NL: 'EUR',
    BE: 'EUR',
    CH: 'CHF',
    SG: 'SGD',
    AU: 'AUD',
    NZ: 'NZD',
    IN: 'INR',
  }
  return map[c] ?? null
}

/* -------------------------------------------------------------
   Convert bigint → number safely
------------------------------------------------------------- */
function toNum(v: number | bigint | null | undefined): number | null {
  if (v == null) return null
  try {
    return typeof v === 'bigint' ? Number(v) : v
  } catch {
    return null
  }
}

/* -------------------------------------------------------------
   Compact number formatter → "120k"
------------------------------------------------------------- */
function fmtCompact(v: number) {
  if (!Number.isFinite(v)) return null
  if (v >= 1000) return `${Math.round(v / 1000)}k`
  return String(v)
}

/* -------------------------------------------------------------
   Helpers to prevent HTML/garbage showing as salary
------------------------------------------------------------- */
function looksLikeHtmlOrEscapedHtml(s: string): boolean {
  const t = (s || '').trim()
  if (!t) return false

  // Raw HTML tags or common fragments from scraped descriptions
  if (/[<>]/.test(t)) return true
  if (t.toLowerCase().includes('<div') || t.toLowerCase().includes('<p')) return true

  // Escaped HTML (&lt;div ...&gt;)
  if (t.includes('&lt;') || t.includes('&gt;')) return true

  // “content-intro” is the exact fragment you’re seeing
  if (t.toLowerCase().includes('content-intro')) return true

  return false
}

function looksSalaryLikeText(s: string): boolean {
  const t = (s || '').trim()
  if (!t) return false
  if (looksLikeHtmlOrEscapedHtml(t)) return false

  // Must have at least one digit
  if (!/\d/.test(t)) return false

  // Strong positive signals
  const hasCurrency =
    /(\$|€|£|¥|₹)\s*\d/.test(t) ||
    /\b(usd|eur|gbp|aud|cad|chf|sgd|inr|jpy)\b/i.test(t)

  const hasPeriod =
    /\b(per\s*(year|yr|month|mo|hour|hr))\b/i.test(t) ||
    /\/\s*(year|yr|month|mo|hour|hr)\b/i.test(t)

  const hasRangeOrPlus = /(\d\s*[-–]\s*\d)|(\+)|(\bto\b)/i.test(t)

  // If it has currency or period markers, it’s very likely salary.
  if (hasCurrency || hasPeriod) return true

  // Otherwise require some “salary-ish” pattern (e.g. 100k, 120000)
  const hasK = /\b\d{2,3}\s*k\b/i.test(t)
  const hasBigNumber = /\b\d{5,7}\b/.test(t) // 100000 - 9999999
  const hasCompWords = /\b(salary|compensation|pay|base)\b/i.test(t)

  return hasK || hasBigNumber || hasCompWords || hasRangeOrPlus
}

/* -------------------------------------------------------------
   Build salary text
------------------------------------------------------------- */
export function buildSalaryText(job: SalaryJob): string | null {
  let min = toNum(job.minAnnual)
  let max = toNum(job.maxAnnual)
  let cur = job.currency

  // Fallback to legacy fields
  if (min == null && max == null) {
    min = toNum(job.salaryMin)
    max = toNum(job.salaryMax)
    cur = job.salaryCurrency || cur
  }

  // Reject invalid values
  if (min != null && (!Number.isFinite(min) || min <= 0)) min = null
  if (max != null && (!Number.isFinite(max) || max <= 0)) max = null

  // Currency-aware six-figure minimums
  const MIN_BY_CURRENCY: Record<string, number> = {
    USD: 100000,
    EUR: 90000,
    GBP: 85000,
    SEK: 1000000,
    NOK: 1000000,
    DKK: 900000,
    INR: 3000000,
  }

  const minThreshold = cur && MIN_BY_CURRENCY[cur.toUpperCase()]

  if (minThreshold) {
    if (min != null && min < minThreshold) min = null
    if (max != null && max < minThreshold) max = null
  }

  // Country → currency correction (non-remote)
  const expectedCurrency = currencyForCountry(job.countryCode)
  const isRemote = job.remote === true || job.remoteMode === "remote"

  if (!isRemote && expectedCurrency) {
    cur = expectedCurrency
  }

  // Canonical formatter handles caps + High salary role
  if (min != null || max != null) {
    return formatSalaryRange(min, max, cur ?? null)
  }

  return null
}





