// lib/currency/thresholds.ts
// Defines what counts as a "High Salary" in different currencies.
// Values are roughly normalized to equivalent purchasing power of $100k USD in tech hubs.

export const HIGH_SALARY_THRESHOLDS = {
  USD: 100000, // United States
  EUR: 80000,  // Europe (approx ~85k USD, adjusted for lower cost of living/taxes)
  GBP: 70000,  // UK (approx ~88k USD)
  CAD: 120000, // Canada (approx ~88k USD)
  AUD: 140000, // Australia (approx ~92k USD)
  SGD: 120000, // Singapore
  CHF: 110000, // Switzerland (High cost of living)
  NOK: 1_000_000, // Norway (~$100k USD equivalent)
  SEK: 1_000_000, // Sweden (~$100k USD equivalent)
  DKK: 700_000,   // Denmark (~$100k USD equivalent)
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
 * Checks if a salary is considered "High" based on its currency.
 */
export function isHighSalary(amount: number, currency: string): boolean {
  const threshold = getHighSalaryThresholdAnnual(currency)
  if (threshold == null) return false
  return amount >= threshold
}
