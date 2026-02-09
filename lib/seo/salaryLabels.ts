import { getHighSalaryThresholdAnnual } from '../currency/thresholds'
import { getCurrencyForCountry, getMinSalaryForCountry } from '../jobs/salaryThresholds'

const CURRENCY_PREFIX: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  NZD: 'NZ$',
  CHF: 'CHF ',
  SEK: 'SEK ',
  NOK: 'NOK ',
  DKK: 'DKK ',
}

function formatAmountShort(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0'
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000
    const rounded = Number.isInteger(millions)
      ? String(millions)
      : millions.toFixed(1)
    return `${rounded}M`
  }
  const thousands = Math.round(amount / 1000)
  return `${thousands}k`
}

export function formatCurrencyShort(amount: number, currency: string): string {
  const code = String(currency || 'USD').toUpperCase()
  const prefix = CURRENCY_PREFIX[code] ?? `${code} `
  return `${prefix}${formatAmountShort(amount)}`
}

export function getThresholdLabelForCurrency(
  currency: string | null | undefined
): string {
  const code = String(currency || '').trim().toUpperCase()
  const threshold = getHighSalaryThresholdAnnual(code)
  if (!threshold) return '$100k+'
  return `${formatCurrencyShort(threshold, code)}+`
}

export function getThresholdLabelForCountry(
  countryCode: string | null | undefined
): string {
  const code = String(countryCode || '').trim().toUpperCase()
  if (!code) return '$100k+'

  const currency = getCurrencyForCountry(code)
  const threshold = getMinSalaryForCountry(code)
  if (!currency || !threshold) return '$100k+'

  return `${formatCurrencyShort(threshold, currency)}+`
}
