// lib/normalizers/salary.ts
// Multi-currency salary normalizer with local thresholds
// Phase 4: adds country→currency helpers + currency/location consistency checks

export type SalaryInterval = 'year' | 'month' | 'week' | 'day' | 'hour' | null
export type SupportedCurrency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AUD'
  | 'CAD'
  | 'CHF'
  | 'SGD'
  | 'NZD'
  | 'INR'
  | 'SEK'

/**
 * High-salary thresholds by currency (annual)
 * These are the MINIMUM annual salaries we consider "high paying"
 */
export const HIGH_SALARY_THRESHOLDS: Record<SupportedCurrency, number> = {
  USD: 90_000, // $90K USD
  EUR: 90_000, // €90K EUR
  GBP: 75_000, // £75K GBP
  AUD: 100_000, // A$100K AUD
  CAD: 100_000, // C$100K CAD
  CHF: 100_000, // CHF 100K
  SGD: 120_000, // S$120K SGD
  NZD: 110_000, // NZ$110K NZD
  INR: 2_500_000, // ₹25L INR
  SEK: 900_000, // 900K SEK
}

/**
 * Country → expected local currency mapping (for trust layer)
 *
 * NOTE: This is intentionally opinionated and *not* exhaustive.
 * You can expand with more country codes as needed.
 */
export const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = {
  US: 'USD',
  // Canada
  CA: 'CAD',
  // Australia & New Zealand
  AU: 'AUD',
  NZ: 'NZD',
  // Singapore
  SG: 'SGD',
  // UK / Great Britain
  GB: 'GBP',
  UK: 'GBP',
  // Eurozone (common cases)
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
  // Switzerland
  CH: 'CHF',
  // Sweden
  SE: 'SEK',
  // India
  IN: 'INR',
}

/**
 * High-level helper result for currency/location consistency
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
 */
const CURRENCY_PATTERNS: Array<{ pattern: RegExp; currency: SupportedCurrency }> = [
  // Multi-char symbols first (order matters!)
  { pattern: /A\$|AU\$|AUD/i, currency: 'AUD' },
  { pattern: /C\$|CA\$|CAD/i, currency: 'CAD' },
  { pattern: /NZ\$|NZD/i, currency: 'NZD' },
  { pattern: /S\$|SG\$|SGD/i, currency: 'SGD' },
  { pattern: /CHF|Fr\./i, currency: 'CHF' },
  { pattern: /SEK|kr/i, currency: 'SEK' },
  { pattern: /₹|INR|lakh|lakhs/i, currency: 'INR' },
  // Single-char symbols last
  { pattern: /€|EUR/i, currency: 'EUR' },
  { pattern: /£|GBP/i, currency: 'GBP' },
  { pattern: /\$|USD/i, currency: 'USD' }, // Default $ to USD
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
  currency: SupportedCurrency | string | null
  interval: SalaryInterval
  isHighSalary: boolean
}

export interface ParsedSalaryFromText {
  min: number | null
  max: number | null
  currency: SupportedCurrency | null
  interval: SalaryInterval
  raw: string
}

/**
 * Normalize salary to annual in LOCAL currency (no FX conversion)
 * and determine if it meets the high-salary threshold for that currency
 */
export function normalizeSalary(input: RawSalaryInput): NormalizedSalary {
  const interval = normalizeInterval(input.interval)
  const currency = normalizeCurrency(input.currency)
  const factor = getIntervalFactor(interval)

  const minAnnual = input.min != null ? toBigInt(input.min) * factor : null
  const maxAnnual = input.max != null ? toBigInt(input.max) * factor : null

  // Check if meets high-salary threshold
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
  if (!currency) return false

  const threshold = HIGH_SALARY_THRESHOLDS[currency as SupportedCurrency]
  if (!threshold) return false

  const thresholdBigInt = BigInt(threshold)

  // Use maxAnnual if available (gives benefit of doubt), otherwise minAnnual
  const salaryToCheck = maxAnnual ?? minAnnual
  if (!salaryToCheck) return false

  return salaryToCheck >= thresholdBigInt
}

/**
 * Parse salary from raw text string
 * Handles formats like:
 *  - "$120,000 - $150,000"
 *  - "€80k - €100k"
 *  - "$150k/year"
 *  - "£60,000 - £80,000 per annum"
 *  - "$50/hour"
 *  - "A$120,000 - A$150,000"
 *  - "₹25 LPA" (Indian format)
 */
export function parseSalaryFromText(text: string | null | undefined): ParsedSalaryFromText | null {
  if (!text || typeof text !== 'string') return null

  const cleaned = text.trim()
  if (!cleaned) return null

  // Detect currency
  const currency = detectCurrency(cleaned)

  // Extract numbers
  const numbers = extractNumbers(cleaned, currency)
  if (numbers.length === 0) return null

  // Detect interval
  const interval = detectInterval(cleaned)

  // Parse min/max
  let min: number | null = null
  let max: number | null = null

  if (numbers.length === 1) {
    min = numbers[0]
    max = numbers[0]
  } else if (numbers.length >= 2) {
    // Sort to ensure min < max
    const sorted = [...numbers].sort((a, b) => a - b)
    min = sorted[0]
    max = sorted[sorted.length - 1]
  }

  return {
    min,
    max,
    currency,
    interval,
    raw: text,
  }
}

/**
 * Detect currency from text
 */
function detectCurrency(text: string): SupportedCurrency | null {
  for (const { pattern, currency } of CURRENCY_PATTERNS) {
    if (pattern.test(text)) {
      return currency
    }
  }
  return null
}

/**
 * Extract numbers from salary text, handling K/M/L suffixes
 */
function extractNumbers(text: string, currency: SupportedCurrency | null): number[] {
  const numbers: number[] = []

  // Handle Indian Lakh format: "25 LPA", "25L", "25 lakhs"
  if (currency === 'INR') {
    const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:l(?:akh?s?)?|lpa)/gi)
    if (lakhMatch) {
      for (const match of lakhMatch) {
        const num = parseFloat(match.replace(/[^\d.]/g, ''))
        if (!isNaN(num)) {
          numbers.push(num * 100_000) // 1 lakh = 100,000
        }
      }
      if (numbers.length > 0) return numbers
    }
  }

  // Standard formats: $120,000 or $120k or $1.5M
  const regex = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([kKmM])?/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    let num = parseFloat(match[1].replace(/,/g, ''))
    const suffix = match[2]?.toLowerCase()

    if (suffix === 'k') num *= 1_000
    else if (suffix === 'm') num *= 1_000_000

    // Filter out obviously wrong numbers (like years: 2024, 2025)
    if (num >= 1000 && num <= 50_000_000) {
      // Also filter out numbers that look like years
      if (num < 1900 || num > 2100) {
        numbers.push(num)
      }
    }
  }

  return numbers
}

/**
 * Detect salary interval from text
 */
function detectInterval(text: string): SalaryInterval {
  const lower = text.toLowerCase()

  if (/per\s*hour|\/\s*h(?:ou)?r|hourly|\bph\b/i.test(lower)) return 'hour'
  if (/per\s*day|\/\s*day|daily/i.test(lower)) return 'day'
  if (/per\s*week|\/\s*week|weekly|\bpw\b/i.test(lower)) return 'week'
  if (/per\s*month|\/\s*month|monthly|\bpm\b|\/mo\b/i.test(lower)) return 'month'
  if (/per\s*(year|annum)|\/\s*y(?:ea)?r|annual|yearly|\bpa\b|\blpa\b/i.test(lower)) return 'year'

  // Default: if numbers are large enough, assume annual
  return 'year'
}

/**
 * Helper to convert a Job's existing salary fields
 */
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
 * Get the display threshold for a currency
 */
export function getThresholdForCurrency(currency: string): number | null {
  return HIGH_SALARY_THRESHOLDS[currency as SupportedCurrency] ?? null
}

/**
 * Get currency symbol for display
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
      return 'kr '
    case 'USD':
    default:
      return '$'
  }
}

/* ------------------------------------------------------------------ */
/* Display helpers with safety clamps                                 */
/* ------------------------------------------------------------------ */

const MAX_REASONABLE_ANNUAL_DEFAULT = 1_500_000 // 1.5M local currency
const MAX_REASONABLE_ANNUAL_INR = 100_000_000   // ₹100M
const MAX_REASONABLE_ANNUAL_SEK = 20_000_000    // 20M SEK

function sanitizeAnnualForDisplay(
  amount: number | null,
  currency: string | null
): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null

  const upper = currency?.toUpperCase() ?? ''
  let limit = MAX_REASONABLE_ANNUAL_DEFAULT

  if (upper === 'INR') {
    limit = MAX_REASONABLE_ANNUAL_INR
  } else if (upper === 'SEK') {
    limit = MAX_REASONABLE_ANNUAL_SEK
  }

  // If the number is way above any plausible annual salary,
  // treat it as untrustworthy for display.
  if (amount > limit) {
    return null
  }

  return amount
}

/**
 * Format salary for display
 */
export function formatSalary(
  amount: bigint | number | null,
  currency: string | null
): string {
  if (amount == null) return 'Not specified'

  const rawNum = typeof amount === 'bigint' ? Number(amount) : amount
  const num = sanitizeAnnualForDisplay(rawNum, currency)
  const symbol = getCurrencySymbol(currency)

  if (num == null) {
    // We know there's some salary info, but it's not trustworthy numerically.
    return `${symbol}High salary role`
  }

  if (num >= 1_000_000) {
    return `${symbol}${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${symbol}${Math.round(num / 1000)}K`
  }
  return `${symbol}${num.toLocaleString()}`
}

/**
 * Format salary range for display
 */
export function formatSalaryRange(
  min: bigint | number | null,
  max: bigint | number | null,
  currency: string | null
): string {
  if (min == null && max == null) return 'Salary not specified'

  const symbol = getCurrencySymbol(currency)
  const rawMin =
    min != null ? (typeof min === 'bigint' ? Number(min) : min) : null
  const rawMax =
    max != null ? (typeof max === 'bigint' ? Number(max) : max) : null

  const minNum = sanitizeAnnualForDisplay(rawMin, currency)
  const maxNum = sanitizeAnnualForDisplay(rawMax, currency)

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${Math.round(n / 1000)}K`
    return n.toLocaleString()
  }

  // If both ends look insane, fall back to a neutral, trust-preserving label.
  if (minNum == null && maxNum == null) {
    return `${symbol}High salary role`
  }

  if (minNum != null && maxNum != null && minNum !== maxNum) {
    return `${symbol}${fmt(minNum)} - ${symbol}${fmt(maxNum)}`
  }
  if (minNum != null) {
    return `${symbol}${fmt(minNum)}+`
  }
  if (maxNum != null) {
    return `Up to ${symbol}${fmt(maxNum)}`
  }
  return 'Salary not specified'
}

/* ------------------------------------------------------------------ */
/* Phase 4 helpers: country ↔ currency consistency                    */
/* ------------------------------------------------------------------ */

/**
 * Given a country code, return the expected local currency (if we know it)
 */
export function getExpectedCurrencyForCountry(
  countryCode: string | null | undefined
): SupportedCurrency | null {
  if (!countryCode) return null
  const cc = countryCode.trim().toUpperCase()
  return COUNTRY_TO_CURRENCY[cc] ?? null
}

/**
 * Check whether a job's currency matches what we'd expect for its country.
 * This is used by:
 *  - repair scripts (auto-fix mismatches)
 *  - UI layer (fallback display when inconsistent)
 */
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
/* Internal helpers                                                   */
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

  // Map common variations
  if (v === '$' || v === 'USD' || v === 'US$' || v === 'US') return 'USD'
  if (v === '€' || v === 'EUR') return 'EUR'
  if (v === '£' || v === 'GBP') return 'GBP'
  if (v === 'A$' || v === 'AU$' || v === 'AUD') return 'AUD'
  if (v === 'C$' || v === 'CA$' || v === 'CAD') return 'CAD'
  if (v === 'CHF' || v === 'FR') return 'CHF'
  if (v === 'S$' || v === 'SG$' || v === 'SGD') return 'SGD'
  if (v === 'NZ$' || v === 'NZD') return 'NZD'
  if (v === '₹' || v === 'INR' || v === 'RS') return 'INR'
  if (v === 'KR' || v === 'SEK') return 'SEK'

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
      return BigInt(260) // ~working days per year
    case 'hour':
      return BigInt(2080) // 40h * 52 weeks
    default:
      return BigInt(1)
  }
}
