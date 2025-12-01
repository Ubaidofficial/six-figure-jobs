// lib/utils/salaryLabels.ts
// Generate localized salary band labels (e.g., CHF 100k+ / €92k+)

type CurrencyMeta = {
  symbol: string
  eurRate?: number // approximate conversion to EUR (1 unit of currency * eurRate = EUR)
}

const CURRENCY_META: Record<string, CurrencyMeta> = {
  USD: { symbol: '$', eurRate: 0.92 },
  CAD: { symbol: '$', eurRate: 0.67 },
  GBP: { symbol: '£', eurRate: 1.15 },
  EUR: { symbol: '€', eurRate: 1 },
  CHF: { symbol: 'CHF', eurRate: 1.04 },
  AUD: { symbol: 'A$', eurRate: 0.62 },
  NZD: { symbol: 'NZ$', eurRate: 0.57 },
  SGD: { symbol: 'S$', eurRate: 0.69 },
  NOK: { symbol: 'kr', eurRate: 0.09 },
  SEK: { symbol: 'kr', eurRate: 0.09 },
  DKK: { symbol: 'kr', eurRate: 0.13 },
}

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  IE: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  BE: 'EUR',
  AT: 'EUR',
  FI: 'EUR',
  CH: 'CHF',
  SG: 'SGD',
  AU: 'AUD',
  NZ: 'NZD',
}

function bandToK(minAnnual: number): number {
  return Math.round(minAnnual / 1000)
}

export function formatSalaryBandLabel(
  minAnnual: number,
  countryCode?: string | null
): string {
  const cc = (countryCode || '').toUpperCase()
  const currency = COUNTRY_TO_CURRENCY[cc] || 'USD'
  const meta = CURRENCY_META[currency] || { symbol: '$' }

  const primary = `${meta.symbol}${bandToK(minAnnual)}k+`

  // For non-EUR European currencies, show an approximate EUR band as well.
  if (currency !== 'EUR' && meta.eurRate) {
    const eurK = Math.round((minAnnual * meta.eurRate) / 1000)
    // Avoid duplicating if EUR would be identical (e.g., close to USD)
    if (eurK && currency !== 'USD') {
      return `${primary} / €${eurK}k+`
    }
  }

  return primary
}
