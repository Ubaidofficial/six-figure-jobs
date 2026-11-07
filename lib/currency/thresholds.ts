// lib/currency/thresholds.ts
// Defines what counts as a "High Salary" in different currencies.
// Keep this as the SINGLE source of truth for per-currency thresholds.

export const HIGH_SALARY_THRESHOLDS = {
  USD: BigInt(100_000), // United States
  GBP: BigInt(75_000), // United Kingdom
  EUR: BigInt(80_000), // Eurozone
  CAD: BigInt(120_000), // Canada
  AUD: BigInt(140_000), // Australia
  CHF: BigInt(90_000), // Switzerland
  SGD: BigInt(130_000), // Singapore

  // Additional currencies used across the site (keep in sync with target regions/slices)
  NZD: BigInt(150_000), // New Zealand (roughly aligned with AU/NZ market)
  NOK: BigInt(1_000_000), // Norway
  SEK: BigInt(1_000_000), // Sweden
  DKK: BigInt(700_000), // Denmark
} as const satisfies Record<string, bigint>

export type HighSalaryCurrency = keyof typeof HIGH_SALARY_THRESHOLDS

/**
 * Currencies where a salary range counts when its TOP reaches the threshold (a job paying EUR 70-95k qualifies at
 * EUR 80k), as long as its bottom is at least TOP_OF_RANGE_MIN_SHARE of the threshold. In every other currency the
 * BOTTOM of the range must reach the threshold. Euro jobs only for now: European employers publish ranges more often
 * than flat figures, and freehire's 30-day pool for 9 euro countries (measured 2026-11-07) went from 1,670 to 2,691 jobs
 * with this rule.
 */
export const TOP_OF_RANGE_CURRENCIES: ReadonlySet<string> = new Set(['EUR'])

/** Lowest bottom-of-range accepted under the top-of-range rule, as a share of the threshold (0.75 -> EUR 60,000). */
export const TOP_OF_RANGE_MIN_SHARE = 0.75

/** Lowest annual salary that can qualify in `currency` (the threshold, or less under the top-of-range rule). */
export function getSalaryFloorAnnual(currency: string | null | undefined): number | null {
  const threshold = getHighSalaryThresholdAnnual(currency)
  if (threshold == null) return null
  const code = String(currency).trim().toUpperCase()
  return TOP_OF_RANGE_CURRENCIES.has(code) ? Math.round(threshold * TOP_OF_RANGE_MIN_SHARE) : threshold
}

export function getHighSalaryThresholdAnnual(
  currency: string | null | undefined
): number | null {
  if (!currency) return null
  const code = String(currency).trim().toUpperCase()
  if (!code) return null
  if (code in HIGH_SALARY_THRESHOLDS) {
    const v = HIGH_SALARY_THRESHOLDS[code as HighSalaryCurrency]
    return typeof v === 'bigint' ? Number(v) : null
  }
  return null
}

/**
 * Checks if a salary is considered "High" based on its currency threshold.
 */
export function isHighSalary(amount: number, currency: string): boolean {
  const threshold = getHighSalaryThresholdAnnual(currency)
  if (threshold == null) return false
  return amount >= threshold
}
