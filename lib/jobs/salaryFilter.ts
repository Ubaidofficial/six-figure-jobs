// lib/jobs/salaryFilter.ts
//
// The minimum-salary filter on listing pages (?minSalary=…). It compares amounts in one currency: the selected
// country's, or US dollars when no country (or one without a mapping) is selected. The page query and the filter's
// labels both read this module, so a "£150k+" pill always filters in pounds.

/** The choices offered as pills ("Any" = no parameter, the site's $100k+ floor). */
export const SALARY_FILTER_STEPS = [150_000, 200_000, 250_000, 300_000] as const

const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  DE: 'EUR',
  NL: 'EUR',
  AU: 'AUD',
}

const SYMBOL: Record<string, string> = { USD: '$', GBP: '£', CAD: 'C$', EUR: '€', AUD: 'A$' }

/** The currency `minSalary` is compared in for this country; US dollars when there is none or no mapping. */
export function salaryFilterCurrency(countryCode?: string | null): string {
  return COUNTRY_CURRENCY[String(countryCode || '').toUpperCase()] ?? 'USD'
}

/** "£150k+" */
export function salaryFilterLabel(amount: number, currency: string): string {
  return `${SYMBOL[currency] ?? `${currency} `}${Math.round(amount / 1000)}k+`
}
