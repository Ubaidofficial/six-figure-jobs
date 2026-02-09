// lib/utils/salaryLabels.ts
// Generate localized salary band labels (e.g., £75k+ or A$140k+)

import { getCurrencyForCountry, getMinSalaryForCountry } from '../jobs/salaryThresholds'

type CurrencyMeta = {
  symbol: string
  eurRate?: number // approximate conversion to EUR (1 unit of currency * eurRate = EUR)
}

const CURRENCY_META: Record<string, CurrencyMeta> = {
  USD: { symbol: '$', eurRate: 0.92 },
  CAD: { symbol: 'C$', eurRate: 0.67 },
  GBP: { symbol: '£', eurRate: 1.15 },
  EUR: { symbol: '€', eurRate: 1 },
  CHF: { symbol: 'CHF', eurRate: 1.04 },
  AUD: { symbol: 'A$', eurRate: 0.62 },
  NZD: { symbol: 'NZ$', eurRate: 0.57 },
  SGD: { symbol: 'S$', eurRate: 0.69 },
  NOK: { symbol: 'NOK', eurRate: 0.09 },
  SEK: { symbol: 'SEK', eurRate: 0.09 },
  DKK: { symbol: 'DKK', eurRate: 0.13 },
}

function bandToK(minAnnual: number): number {
  return Math.round(minAnnual / 1000)
}

export function formatSalaryBandLabel(
  minAnnual: number,
  countryCode?: string | null
): string {
  const cc = (countryCode || '').toUpperCase()
  const localCurrency = getCurrencyForCountry(cc)
  const localThreshold = getMinSalaryForCountry(cc)

  const resolvedMinAnnual =
    minAnnual <= 100_000 && localThreshold ? localThreshold : minAnnual

  const currency = localCurrency || 'USD'
  const meta = CURRENCY_META[currency] || { symbol: '$' }

  const primary = `${meta.symbol}${bandToK(resolvedMinAnnual)}k+`

  // For non-EUR European currencies, show an approximate EUR band as well.
  if (currency !== 'EUR' && meta.eurRate) {
    const eurK = Math.round((resolvedMinAnnual * meta.eurRate) / 1000)
    // Avoid duplicating if EUR would be identical (e.g., close to USD)
    if (eurK && currency !== 'USD') {
      return `${primary} / €${eurK}k+`
    }
  }

  return primary
}
