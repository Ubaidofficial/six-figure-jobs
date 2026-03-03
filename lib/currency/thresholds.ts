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
