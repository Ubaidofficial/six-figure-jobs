// lib/seo/regions.ts
// Target regions + high-salary thresholds used for programmatic slices

import {
  HIGH_SALARY_THRESHOLDS,
  getHighSalaryThresholdAnnual,
} from '../currency/thresholds'

export type TargetCountry = {
  code: string
  label: string
  currency: keyof typeof HIGH_SALARY_THRESHOLDS
}

export const TARGET_COUNTRIES: TargetCountry[] = [
  { code: 'US', label: 'United States', currency: 'USD' },
  { code: 'CA', label: 'Canada', currency: 'CAD' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { code: 'IE', label: 'Ireland', currency: 'EUR' },
  { code: 'DE', label: 'Germany', currency: 'EUR' },
  { code: 'FR', label: 'France', currency: 'EUR' },
  { code: 'ES', label: 'Spain', currency: 'EUR' },
  { code: 'NL', label: 'Netherlands', currency: 'EUR' },
  { code: 'SE', label: 'Sweden', currency: 'SEK' },
  { code: 'NO', label: 'Norway', currency: 'NOK' },
  { code: 'DK', label: 'Denmark', currency: 'DKK' },
  { code: 'BE', label: 'Belgium', currency: 'EUR' },
  { code: 'AT', label: 'Austria', currency: 'EUR' },
  { code: 'FI', label: 'Finland', currency: 'EUR' },
  { code: 'CH', label: 'Switzerland', currency: 'CHF' },
  { code: 'SG', label: 'Singapore', currency: 'SGD' },
  { code: 'AU', label: 'Australia', currency: 'AUD' },
  { code: 'NZ', label: 'New Zealand', currency: 'AUD' }, // treat as AU band
]

export type RemoteRegion = {
  slug: string
  label: string
  description?: string
}

export const REMOTE_REGIONS: RemoteRegion[] = [
  { slug: 'global', label: 'Global' },
  { slug: 'us-only', label: 'Remote (US only)' },
  { slug: 'canada', label: 'Remote (Canada)' },
  { slug: 'emea', label: 'Remote (EMEA)' },
  { slug: 'europe', label: 'Remote (Europe)' },
  { slug: 'apac', label: 'Remote (APAC)' },
  { slug: 'uk-ireland', label: 'Remote (UK & Ireland)' },
]

/**
 * Returns the high-salary annual threshold for the country,
 * or null if unknown/unsupported.
 */
export function highSalaryThresholdForCountry(code: string): number | null {
  const entry = TARGET_COUNTRIES.find(
    (c) => c.code.toUpperCase() === code.toUpperCase(),
  )
  if (!entry) return null

  return getHighSalaryThresholdAnnual(entry.currency)
}
