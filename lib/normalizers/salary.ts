// lib/normalizers/salary.ts
// Multi-currency salary normalizer + deterministic eligibility gates.
// SINGLE threshold source: lib/currency/thresholds.ts

import { getHighSalaryThresholdAnnual } from '../currency/thresholds'

export type SalaryInterval = 'year' | 'month' | 'week' | 'day' | 'hour' | null
export type SupportedCurrency = string

/**
 * Country → expected local currency mapping (trust layer)
 */
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  SG: 'SGD',
  GB: 'GBP',
  UK: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  NL: 'EUR',
  ES: 'EUR',
  PT: 'EUR',
  IE: 'EUR',
  IT: 'EUR',
  AT: 'EUR',
  BE: 'EUR',
  FI: 'EUR',
  LU: 'EUR',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
}

export function inferCurrencyFromCountryCode(
  countryCode: string | null | undefined
): string | null {
  if (!countryCode) return null
  const code = String(countryCode).trim().toUpperCase()
  if (!code) return null
  return COUNTRY_TO_CURRENCY[code] ?? null
}

/* ------------------------------------------------------------------ */
/* Central banned-title helper (Six Figure Jobs board rules)           */
/* ------------------------------------------------------------------ */

/**
 * Titles we never want to validate as “six-figure” even if salary looks high.
 * This prevents “intern/junior/entry” leakage into high-paying feeds.
 */
export function isBannedTitleForSixFigureBoard(
  title: string | null | undefined
): boolean {
  const t = String(title ?? '').toLowerCase().trim()
  if (!t) return false

  return (
    /\b(intern|internship|co[-\s]?op)\b/.test(t) ||
    /\b(junior|jr\.?)\b/.test(t) ||
    /\b(entry[-\s]?level|entry)\b/.test(t) ||
    /\b(apprentice|apprenticeship)\b/.test(t)
  )
}

/**
 * Currency/location consistency check result
 */
export interface CurrencyLocationCheck {
  countryCode: string | null
  currency: string | null
  expectedCurrency: SupportedCurrency | null
  hasCurrency: boolean
  currencyMatches: boolean
  isMismatch: boolean
}

/**
 * Currency detection patterns
 * - Order matters (A$ / C$ / NZ$ must be detected before $).
 * - IMPORTANT: "$" alone is ambiguous. We DO NOT treat "$" as USD here.
 */
const CURRENCY_PATTERNS: Array<{ pattern: RegExp; currency: SupportedCurrency }> = [
  // Strong currency markers first (avoid false positives like "audit" => "AUD")
  { pattern: /₹|\bINR\b|\blakhs?\b|\blpa\b/i, currency: 'INR' },

  { pattern: /A\$|AU\$|\bAUD\b/i, currency: 'AUD' },
  { pattern: /C\$|CA\$|\bCAD\b/i, currency: 'CAD' },
  { pattern: /NZ\$|\bNZD\b/i, currency: 'NZD' },
  { pattern: /S\$|SG\$|\bSGD\b/i, currency: 'SGD' },
  { pattern: /\bCHF\b|Fr\./i, currency: 'CHF' },

  // NOTE: "kr" is ambiguous across SEK/NOK/DKK; only accept explicit codes.
  { pattern: /\bSEK\b/i, currency: 'SEK' },
  { pattern: /\bNOK\b/i, currency: 'NOK' },
  { pattern: /\bDKK\b/i, currency: 'DKK' },

  { pattern: /€|\bEUR\b/i, currency: 'EUR' },
  { pattern: /£|\bGBP\b/i, currency: 'GBP' },
  { pattern: /US\$|\bUSD\b/i, currency: 'USD' },
]

export interface RawSalaryInput {
  min: bigint | number | null | undefined
  max: bigint | number | null | undefined
  currency: string | null | undefined
  interval: SalaryInterval | string | null | undefined
}

export interface NormalizedSalary {
  minAnnual: bigint | null
  maxAnnual: bigint | null
  currency: string | null
  interval: SalaryInterval
  isHighSalary: boolean
}

export type SalarySource = 'ats' | 'salaryRaw' | 'descriptionText' | 'none'

export type SalaryParseReason =
  | 'ok'
  | 'below_threshold'
  | 'unknown_currency'
  | 'bad_range'
  | 'ambiguous'
  | 'too_high'
  | 'capped_description'

export type SalaryValidationResult = {
  salaryValidated: boolean
  salaryConfidence: number
  salarySource: SalarySource
  salaryParseReason: SalaryParseReason
  salaryNormalizedAt: Date
  salaryRejectedAt?: Date
  salaryRejectedReason?: string
}

export function getSalaryConfidenceForSource(source: SalarySource): number {
  if (source === 'ats') return 95
  if (source === 'salaryRaw') return 90
  if (source === 'descriptionText') return 80
  return 0
}

function toNumberSafe(v: bigint | number | null): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'bigint') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  try {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/**
 * Deterministic eligibility gate for "high-paying" jobs.
 * - Uses ONLY getHighSalaryThresholdAnnual() for thresholds
 * - Applies currency-based annual caps
 * - Rejects ambiguous currency
 * - Requires confidence >= 80
 */
export function validateHighSalaryEligibility(input: {
  normalized: NormalizedSalary
  source: SalarySource
  currencyAmbiguous?: boolean
  now?: Date
  title?: string | null
}): SalaryValidationResult {
  const now = input.now ?? new Date()
  const salaryConfidence = getSalaryConfidenceForSource(input.source)
  const salaryNormalizedAt = now

  // Central title ban (optional but recommended everywhere)
  if (isBannedTitleForSixFigureBoard(input.title)) {
    return {
      salaryValidated: false,
      salaryConfidence,
      salarySource: input.source,
      salaryParseReason: 'below_threshold',
      salaryNormalizedAt,
      salaryRejectedAt: now,
      salaryRejectedReason: 'banned-title:intern-junior-entry',
    }
  }

  if (input.currencyAmbiguous) {
    return {
      salaryValidated: false,
      salaryConfidence,
      salarySource: input.source,
      salaryParseReason: 'ambiguous',
      salaryNormalizedAt,
      salaryRejectedAt: now,
      salaryRejectedReason: 'ambiguous-currency',
    }
  }

  const threshold = getHighSalaryThresholdAnnual(input.normalized.currency)
  if (threshold == null) {
    return {
      salaryValidated: false,
      salaryConfidence,
      salarySource: input.source,
      salaryParseReason: 'unknown_currency',
      salaryNormalizedAt,
      salaryRejectedAt: now,
      salaryRejectedReason: 'unknown-or-unsupported-currency',
    }
  }

  const minAnnual = toNumberSafe(input.normalized.minAnnual)
  const maxAnnual = toNumberSafe(input.normalized.maxAnnual)

  if (minAnnual == null && maxAnnual == null) {
    return {
      salaryValidated: false,
      salaryConfidence,
      salarySource: input.source,
      salaryParseReason: 'bad_range',
      salaryNormalizedAt,
      salaryRejectedAt: now,
      salaryRejectedReason: 'missing-annual-salary',
    }
  }

  if (minAnnual != null && maxAnnual != null && minAnnual > maxAnnual) {
    return {
      salaryValidated: false,
      salaryConfidence,
      salarySource: input.source,
      salaryParseReason: 'bad_range',
      salaryNormalizedAt,
      salaryRejectedAt: now,
      salaryRejectedReason: 'min-greater-than-max',
    }
  }

  // Reject absurdly wide ranges (e.g. 50k–500k)
  if (
    minAnnual != null &&
    maxAnnual != null &&
    minAnnual > 0 &&
    maxAnnual / minAnnual > 3
  ) {
    return {
      salaryValidated: false,
      salaryConfidence,
      salarySource: input.source,
      salaryParseReason: 'bad_range',
      salaryNormalizedAt,
      salaryRejectedAt: now,
      salaryRejectedReason: 'range-ratio-too-wide',
    }
  }

  const cap = getAnnualSalaryCapForCurrency(input.normalized.currency)
  if ((minAnnual != null && minAnnual > cap) || (maxAnnual != null && maxAnnual > cap)) {
    return {
      salaryValidated: false,
      salaryConfidence,
      salarySource: input.source,
      salaryParseReason: 'too_high',
      salaryNormalizedAt,
      salaryRejectedAt: now,
      salaryRejectedReason: `annual-salary-over-cap:${cap}`,
    }
  }

  // Additional guardrail: description-derived salaries are too noisy above ~$600k USD equivalent.
  // We prefer rejecting these (rather than clamping) to avoid turning "7M users" into a fake salary.
  if (input.source === 'descriptionText') {
    const usdCap = 600_000
    const annualToCheck = maxAnnual ?? minAnnual
    const usd = toUsdAnnual(annualToCheck, input.normalized.currency)

    if (usd != null && usd > usdCap) {
      return {
        salaryValidated: false,
        salaryConfidence,
        salarySource: input.source,
        salaryParseReason: 'capped_description',
        salaryNormalizedAt,
        salaryRejectedAt: now,
        salaryRejectedReason: `description-salary-over-usd-cap:${usdCap}`,
      }
    }
  }

  if (salaryConfidence < 80) {
    return {
      salaryValidated: false,
      salaryConfidence,
      salarySource: input.source,
      salaryParseReason: 'ambiguous',
      salaryNormalizedAt,
      salaryRejectedAt: now,
      salaryRejectedReason: 'confidence-below-80',
    }
  }

  const meetsThreshold =
    (maxAnnual != null && maxAnnual >= threshold) ||
    (minAnnual != null && minAnnual >= threshold)

  if (!meetsThreshold) {
    return {
      salaryValidated: false,
      salaryConfidence,
      salarySource: input.source,
      salaryParseReason: 'below_threshold',
      salaryNormalizedAt,
      salaryRejectedAt: now,
      salaryRejectedReason: `below-threshold:${threshold}`,
    }
  }

  return {
    salaryValidated: true,
    salaryConfidence,
    salarySource: input.source,
    salaryParseReason: 'ok',
    salaryNormalizedAt,
  }
}

export interface ParsedSalaryFromText {
  min: number | null
  max: number | null
  currency: string | null
  interval: SalaryInterval
  raw: string
}

/**
 * Normalize salary to annual in LOCAL currency (no FX conversion)
 */
export function normalizeSalary(input: RawSalaryInput): NormalizedSalary {
  const interval = normalizeInterval(input.interval)
  const currency = normalizeCurrency(input.currency)
  const factor = getIntervalFactor(interval)

  const minAnnual = input.min != null ? toBigInt(input.min) * factor : null
  const maxAnnual = input.max != null ? toBigInt(input.max) * factor : null

  const isHighSalary = checkHighSalary(minAnnual, maxAnnual, currency)

  return {
    minAnnual,
    maxAnnual,
    currency,
    interval,
    isHighSalary,
  }
}

/**
 * Check if salary meets the high-salary threshold for its currency
 */
export function checkHighSalary(
  minAnnual: bigint | null,
  maxAnnual: bigint | null,
  currency: string | null
): boolean {
  const threshold = getHighSalaryThresholdAnnual(currency)
  if (threshold == null) return false
  const thresholdBigInt = BigInt(threshold)

  const salaryToCheck = maxAnnual ?? minAnnual
  if (!salaryToCheck) return false

  return salaryToCheck >= thresholdBigInt
}

/**
 * Parse salary from raw text string
 */
export function parseSalaryFromText(
  text: string | null | undefined
): ParsedSalaryFromText | null {
  if (!text || typeof text !== 'string') return null

  const cleaned = text.trim()
  if (!cleaned) return null

  const currency = detectCurrency(cleaned)
  const numbers = extractNumbers(cleaned, currency)

  if (numbers.length === 0) return null

  const interval = detectInterval(cleaned)

  let min: number | null = null
  let max: number | null = null

  if (numbers.length === 1) {
    min = numbers[0]
    max = numbers[0]
  } else {
    const sorted = [...numbers].sort((a, b) => a - b)
    min = sorted[0]
    max = sorted[sorted.length - 1]
  }

  return { min, max, currency, interval, raw: text }
}

function detectCurrency(text: string): SupportedCurrency | null {
  for (const { pattern, currency } of CURRENCY_PATTERNS) {
    if (pattern.test(text)) return currency
  }
  return null
}

/**
 * Extract numbers from salary text, handling K/M/L suffixes
 */
function extractNumbers(text: string, currency: SupportedCurrency | null): number[] {
  const numbers: number[] = []

  if (currency === 'INR') {
    const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:l(?:akh?s?)?|lpa)/gi)
    if (lakhMatch) {
      for (const match of lakhMatch) {
        const num = parseFloat(match.replace(/[^\d.]/g, ''))
        if (!isNaN(num)) numbers.push(num * 100_000)
      }
      if (numbers.length > 0) return numbers
    }
  }

  const regex = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([kKmM])?/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    let num = parseFloat(match[1].replace(/,/g, ''))
    const suffix = match[2]?.toLowerCase()

    if (suffix === 'k') num *= 1_000
    else if (suffix === 'm') num *= 1_000_000

    const idx = match.index ?? -1
    const prefixWindow = idx >= 0 ? text.slice(Math.max(0, idx - 6), idx) : ''
    const suffixWindow =
      idx >= 0
        ? text.slice(idx + match[0].length, Math.min(text.length, idx + match[0].length + 6))
        : ''

    const hasCurrencyNearNumber =
      /(?:US\$|A\$|C\$|NZ\$|S\$|₹|€|£|\$)\s*$/i.test(prefixWindow) ||
      /^\s*(?:USD|EUR|GBP|AUD|CAD|SGD|INR|CHF|SEK|NOK|DKK)\b/i.test(suffixWindow) ||
      currency != null

    // Filter out obviously wrong numbers (like years: 2024, 2025), but allow sub-1000 hourly/day rates
    // when they are directly tied to a currency marker (e.g. "$150 per hour").
    if (num >= 1000 && num <= 50_000_000) {
      if (num < 1900 || num > 2100) numbers.push(num)
    } else if (num >= 10 && num < 1000 && hasCurrencyNearNumber) {
      numbers.push(num)
    }
  }

  return numbers
}

function detectInterval(text: string): SalaryInterval {
  const raw = String(text || '')
  const lower = raw.toLowerCase()

  // Only accept interval keywords when they appear close to a money-ish token.
  // This prevents phrases like "hourly employees" from impacting salary interval.
  const window = 30

  const moneyTokenRe =
    /(?:US\$|A\$|C\$|NZ\$|S\$|CHF|SEK|NOK|DKK|USD|EUR|GBP|AUD|CAD|SGD|INR|₹|€|£|\$)\s*\d[\d,.\s]*[kKmM]?|\d[\d,.\s]*[kKmM]?\s*(?:USD|EUR|GBP|AUD|CAD|SGD|INR|CHF|SEK|NOK|DKK)\b/g

  const matches = Array.from(raw.matchAll(moneyTokenRe))
  if (matches.length === 0) return 'year'
  for (const m of matches) {
    const idx = m.index ?? -1
    if (idx < 0) continue
    const start = Math.max(0, idx - window)
    const end = Math.min(raw.length, idx + String(m[0] || '').length + window)
    const near = lower.slice(start, end)

    if (/per\s*hour|\/\s*h(?:ou)?r|hourly|\bph\b/.test(near)) return 'hour'
    if (/per\s*day|\/\s*day|daily/.test(near)) return 'day'
    if (/per\s*week|\/\s*week|weekly|\bpw\b/.test(near)) return 'week'
    if (/per\s*month|\/\s*month|monthly|\bpm\b|\/mo\b/.test(near)) return 'month'
    if (/per\s*(year|annum)|\/\s*y(?:ea)?r|annual|yearly|\bpa\b|\blpa\b/.test(near)) return 'year'
  }

  return 'year'
}

/* ------------------------------------------------------------------ */
/* USD-equivalent helpers (approximate; used for guardrails only)      */
/* ------------------------------------------------------------------ */

export function estimateUsdAnnual(
  localAnnual: bigint | number | null | undefined,
  currency: string | null | undefined
): number | null {
  return toUsdAnnual(toNumberSafe(localAnnual ?? null), currency ?? null)
}

export function estimateUsdAnnualFromNormalized(normalized: NormalizedSalary): number | null {
  const annual = normalized.maxAnnual ?? normalized.minAnnual
  return estimateUsdAnnual(annual, normalized.currency)
}

// Currency-units per 1 USD (same orientation used by audit scripts).
// This is intentionally small + conservative; override via env if needed.
const USD_FX_UNITS_PER_1_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.90,
  SEK: 10.4,
  NOK: 10.4,
  DKK: 6.8,
  SGD: 1.35,
  INR: 83.0,
  NZD: 1.65,
}

function toUsdAnnual(localAnnual: number | null, currency: string | null): number | null {
  if (localAnnual == null || !Number.isFinite(localAnnual) || localAnnual <= 0) return null
  const c = currency?.toUpperCase() ?? ''
  const rate = USD_FX_UNITS_PER_1_USD[c]
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null
  return localAnnual / rate
}

export function normalizeJobSalaryFields(job: {
  salaryMin?: bigint | number | null
  salaryMax?: bigint | number | null
  salaryCurrency?: string | null
  salaryPeriod?: SalaryInterval | string | null
}): NormalizedSalary {
  return normalizeSalary({
    min: job.salaryMin ?? null,
    max: job.salaryMax ?? null,
    currency: job.salaryCurrency ?? null,
    interval: job.salaryPeriod ?? null,
  })
}

/**
 * Currency symbol for display
 */
export function getCurrencySymbol(currency: string | null): string {
  switch (currency) {
    case 'EUR':
      return '€'
    case 'GBP':
      return '£'
    case 'AUD':
      return 'A$'
    case 'CAD':
      return 'C$'
    case 'CHF':
      return 'CHF '
    case 'SGD':
      return 'S$'
    case 'NZD':
      return 'NZ$'
    case 'INR':
      return '₹'
    case 'SEK':
    case 'NOK':
    case 'DKK':
      return 'kr '
    case 'USD':
    default:
      return '$'
  }
}

/* ------------------------------------------------------------------ */
/* Display helpers with safety clamps                                  */
/* ------------------------------------------------------------------ */

const MAX_REASONABLE_ANNUAL_DEFAULT = 1_500_000
const MAX_REASONABLE_ANNUAL_SEK = 20_000_000
const MAX_REASONABLE_ANNUAL_NOK = 20_000_000
const MAX_REASONABLE_ANNUAL_DKK = 20_000_000

export function getAnnualSalaryCapForCurrency(currency: string | null | undefined): number {
  const upper = currency?.toUpperCase() ?? ''
  if (upper === 'SEK') return MAX_REASONABLE_ANNUAL_SEK
  if (upper === 'NOK') return MAX_REASONABLE_ANNUAL_NOK
  if (upper === 'DKK') return MAX_REASONABLE_ANNUAL_DKK
  return MAX_REASONABLE_ANNUAL_DEFAULT
}

export function isAnnualSalaryWithinCap(
  amount: number | null | undefined,
  currency: string | null | undefined
): boolean {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return false
  return amount <= getAnnualSalaryCapForCurrency(currency)
}

function sanitizeAnnualForDisplay(amount: number | null, currency: string | null): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null
  const limit = getAnnualSalaryCapForCurrency(currency)
  if (amount > limit) return null
  return amount
}

export function formatSalary(amount: bigint | number | null, currency: string | null): string {
  if (amount == null) return 'Not specified'

  const rawNum = typeof amount === 'bigint' ? Number(amount) : amount
  const num = sanitizeAnnualForDisplay(rawNum, currency)
  const symbol = getCurrencySymbol(currency)

  if (num == null) return `${symbol}High salary role`

  if (num >= 1_000_000) return `${symbol}${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1000) return `${symbol}${Math.round(num / 1000)}K`
  return `${symbol}${num.toLocaleString()}`
}

export function formatSalaryRange(
  min: bigint | number | null,
  max: bigint | number | null,
  currency: string | null
): string {
  if (min == null && max == null) return 'Salary not specified'

  const symbol = getCurrencySymbol(currency)
  const rawMin = min != null ? (typeof min === 'bigint' ? Number(min) : min) : null
  const rawMax = max != null ? (typeof max === 'bigint' ? Number(max) : max) : null

  const minNum = sanitizeAnnualForDisplay(rawMin, currency)
  const maxNum = sanitizeAnnualForDisplay(rawMax, currency)

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${Math.round(n / 1000)}K`
    return n.toLocaleString()
  }

  if (minNum == null && maxNum == null) return `${symbol}High salary role`

  if (minNum != null && maxNum != null && minNum !== maxNum) {
    return `${symbol}${fmt(minNum)} - ${symbol}${fmt(maxNum)}`
  }
  if (minNum != null) return `${symbol}${fmt(minNum)}+`
  if (maxNum != null) return `Up to ${symbol}${fmt(maxNum)}`
  return 'Salary not specified'
}

/* ------------------------------------------------------------------ */
/* Country ↔ currency consistency                                      */
/* ------------------------------------------------------------------ */

export function getExpectedCurrencyForCountry(
  countryCode: string | null | undefined
): SupportedCurrency | null {
  if (!countryCode) return null
  const cc = String(countryCode).trim().toUpperCase()
  return COUNTRY_TO_CURRENCY[cc] ?? null
}

export function checkCurrencyLocationMismatch(
  countryCode: string | null,
  currency: string | null
): CurrencyLocationCheck {
  const expectedCurrency = getExpectedCurrencyForCountry(countryCode)
  const hasCurrency = !!currency
  const normalizedCurrency = currency ? normalizeCurrency(currency) : null

  const currencyMatches =
    !!expectedCurrency &&
    !!normalizedCurrency &&
    String(normalizedCurrency).toUpperCase() === expectedCurrency

  return {
    countryCode: countryCode ?? null,
    currency: currency ?? null,
    expectedCurrency,
    hasCurrency,
    currencyMatches,
    isMismatch: !!expectedCurrency && hasCurrency && !currencyMatches,
  }
}

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

function toBigInt(value: bigint | number): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return BigInt(0)
    return BigInt(Math.round(value))
  }
  return BigInt(0)
}

function normalizeInterval(raw: SalaryInterval | string | null | undefined): SalaryInterval {
  if (!raw) return null
  const v = String(raw).toLowerCase()

  if (v.startsWith('year') || v === 'annual' || v === 'annually' || v === 'pa') return 'year'
  if (v.startsWith('month') || v === 'pm') return 'month'
  if (v.startsWith('week') || v === 'pw') return 'week'
  if (v.startsWith('day') || v === 'daily') return 'day'
  if (v.startsWith('hour') || v === 'ph') return 'hour'

  return null
}

function normalizeCurrency(raw: string | null | undefined): SupportedCurrency | string | null {
  if (!raw) return null
  const v = raw.trim().toUpperCase()

  // "$" alone is ambiguous (USD vs CAD vs AUD etc). Do not guess here.
  if (v === '$') return null

  if (v === 'USD' || v === 'US$') return 'USD'
  if (v === '€' || v === 'EUR') return 'EUR'
  if (v === '£' || v === 'GBP') return 'GBP'
  if (v === 'A$' || v === 'AU$' || v === 'AUD') return 'AUD'
  if (v === 'C$' || v === 'CA$' || v === 'CAD') return 'CAD'
  if (v === 'CHF' || v === 'FR') return 'CHF'
  if (v === 'S$' || v === 'SG$' || v === 'SGD') return 'SGD'
  if (v === 'NZ$' || v === 'NZD') return 'NZD'
  if (v === '₹' || v === 'INR' || v === 'RS') return 'INR'
  if (v === 'SEK') return 'SEK'
  if (v === 'NOK') return 'NOK'
  if (v === 'DKK') return 'DKK'

  return v || null
}

function getIntervalFactor(interval: SalaryInterval): bigint {
  switch (interval) {
    case 'year':
      return BigInt(1)
    case 'month':
      return BigInt(12)
    case 'week':
      return BigInt(52)
    case 'day':
      return BigInt(260)
    case 'hour':
      return BigInt(2080)
    default:
      return BigInt(1)
  }
}
