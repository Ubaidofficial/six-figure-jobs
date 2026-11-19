// lib/jobs/salaryFilter.ts
//
// The minimum-salary filter on listing pages (?minSalary=…). It compares amounts in one currency: the selected
// country's (COUNTRY_TO_CURRENCY), or US dollars when no country (or one without a mapping) is selected. The page query,
// the API behind "load more" and the filter's labels all read this module, so a "£150k+" pill always filters in pounds.
//
// The URL carries one of the steps below. Where a currency's six-figure threshold is in the same range as $100k (USD,
// GBP, EUR, CAD, AUD, CHF, SGD, NZD), the step is the amount in that currency, as it always was for pounds and euros.
// Krona and krone thresholds are 700,000-1,000,000, so there the step is scaled by threshold / 100,000: "150k" filters
// at SEK 1.5M, not SEK 150,000 (about $14k).

import { getHighSalaryThresholdAnnual } from '../currency/thresholds'
import { COUNTRY_TO_CURRENCY } from '../normalizers/salary'

/** The choices offered as pills ("Any" = no parameter, the site's $100k+ floor). */
export const SALARY_FILTER_STEPS = [150_000, 200_000, 250_000, 300_000] as const

const SYMBOL: Record<string, string> = { USD: '$', GBP: '£', CAD: 'C$', EUR: '€', AUD: 'A$', CHF: 'CHF ', SGD: 'S$', NZD: 'NZ$' }

/** The currency `minSalary` is compared in for this country; US dollars when there is none or no mapping. */
export function salaryFilterCurrency(countryCode?: string | null): string {
  return COUNTRY_TO_CURRENCY[String(countryCode || '').toUpperCase()] ?? 'USD'
}

/** The annual amount, in `currency`, that a `minSalary` step filters at. */
export function salaryFilterAmount(step: number, currency: string): number {
  const threshold = getHighSalaryThresholdAnnual(currency)
  return threshold && threshold > 150_000 ? Math.round((step * threshold) / 100_000) : step
}

/** "£150k+", "SEK 1.5M+" */
export function salaryFilterLabel(step: number, currency: string): string {
  const amount = salaryFilterAmount(step, currency)
  const short = amount >= 1_000_000 ? `${Number((amount / 1_000_000).toFixed(2))}M` : `${Math.round(amount / 1000)}k`
  return `${SYMBOL[currency] ?? `${currency} `}${short}+`
}
