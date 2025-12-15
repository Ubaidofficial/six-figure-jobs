// lib/currency/thresholds.ts
// Defines what counts as a "High Salary" in different currencies.
// Keep this as the SINGLE source of truth for per-currency thresholds.

export const HIGH_SALARY_THRESHOLDS = {
  USD: 100_000,   // United States
  EUR: 80_000,    // Europe (approx high-paying)
  GBP: 70_000,    // United Kingdom
  CAD: 120_000,   // Canada
  AUD: 140_000,   // Australia
  NZD: 150_000,   // New Zealand (roughly aligned with AU/NZ market)
  SGD: 120_000,   // Singapore
  CHF: 110_000,   // Switzerland
  NOK: 1_000_000, // Norway
  SEK: 1_000_000, // Sweden
  DKK: 700_000,   // Denmark
} as const satisfies Record<string, number>

export type HighSalaryCurrency = keyof typeof HIGH_SALARY_THRESHOLDS

export function getHighSalaryThresholdAnnual(
  currency: string | null | undefined
): number | null {
  if (!currency) return null
  const code = String(currency).trim().toUpperCase()
  if (!code) return null
  if (code in HIGH_SALARY_THRESHOLDS) {
    return HIGH_SALARY_THRESHOLDS[code as HighSalaryCurrency] ?? null
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
