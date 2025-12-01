// lib/currency/thresholds.ts
// Defines what counts as a "High Salary" in different currencies.
// Values are roughly normalized to equivalent purchasing power of $100k USD in tech hubs.

export const HIGH_SALARY_THRESHOLDS: Record<string, number> = {
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
}

const DEFAULT_THRESHOLD_USD = 100000

/**
 * Checks if a salary is considered "High" based on its currency.
 */
export function isHighSalary(amount: number, currency: string): boolean {
  const code = currency.toUpperCase()
  const threshold = HIGH_SALARY_THRESHOLDS[code] || DEFAULT_THRESHOLD_USD
  
  return amount >= threshold
}
