// lib/jobs/salaryBands.ts

export type SalaryBandKey = '100-199' | '200-299' | '300-399' | '400-500'

export type SalaryBand = {
  id: SalaryBandKey
  label: string        // for UI
  min: number          // inclusive
  max: number | null   // inclusive; null = no upper bound
}

// Base US bands – your canonical ranges
export const USD_BANDS: SalaryBand[] = [
  {
    id: '100-199',
    label: '$100k–$199k',
    min: 100_000,
    max: 199_999,
  },
  {
    id: '200-299',
    label: '$200k–$299k',
    min: 200_000,
    max: 299_999,
  },
  {
    id: '300-399',
    label: '$300k–$399k',
    min: 300_000,
    max: 399_999,
  },
  {
    id: '400-500',
    label: '$400k–$500k',
    min: 400_000,
    max: 500_000,
  },
]

/**
 * For IE / DE / NL we’ll reuse the EUR numbers.
 *
 * Ranges are rounded, but roughly equivalent to USD using
 * current FX rates (100k USD ≈ 92k EUR, 76k GBP, 146k AUD, 166k NZD). :contentReference[oaicite:0]{index=0}
 */
export const GBP_BANDS: SalaryBand[] = [
  { id: '100-199', label: '£75k–£149k', min: 75_000,  max: 149_999 },
  { id: '200-299', label: '£150k–£224k', min: 150_000, max: 224_999 },
  { id: '300-399', label: '£225k–£299k', min: 225_000, max: 299_999 },
  { id: '400-500', label: '£300k–£375k', min: 300_000, max: 375_000 },
]

export const EUR_BANDS: SalaryBand[] = [
  { id: '100-199', label: '€90k–€179k',  min: 90_000,  max: 179_999 },
  { id: '200-299', label: '€180k–€269k', min: 180_000, max: 269_999 },
  { id: '300-399', label: '€270k–€359k', min: 270_000, max: 359_999 },
  { id: '400-500', label: '€360k–€449k', min: 360_000, max: 449_999 },
]

export const AUD_BANDS: SalaryBand[] = [
  { id: '100-199', label: 'A$150k–A$299k', min: 150_000, max: 299_999 },
  { id: '200-299', label: 'A$300k–A$449k', min: 300_000, max: 449_999 },
  { id: '300-399', label: 'A$480k–A$649k', min: 480_000, max: 649_999 },
  { id: '400-500', label: 'A$650k–A$800k', min: 650_000, max: 800_000 },
]

export const NZD_BANDS: SalaryBand[] = [
  { id: '100-199', label: 'NZ$150k–NZ$349k', min: 150_000, max: 349_999 },
  { id: '200-299', label: 'NZ$360k–NZ$499k', min: 360_000, max: 499_999 },
  { id: '300-399', label: 'NZ$500k–NZ$649k', min: 500_000, max: 649_999 },
  { id: '400-500', label: 'NZ$650k–NZ$800k', min: 650_000, max: 800_000 },
]

type CountryCode =
  | 'US'
  | 'GB'
  | 'IE'
  | 'DE'
  | 'NL'
  | 'AU'
  | 'NZ'

const COUNTRY_TO_BANDS: Record<CountryCode, SalaryBand[]> = {
  US: USD_BANDS,
  GB: GBP_BANDS,
  IE: EUR_BANDS,
  DE: EUR_BANDS,
  NL: EUR_BANDS,
  AU: AUD_BANDS,
  NZ: NZD_BANDS,
}

/**
 * Get the salary bands to show for a given country.
 * Falls back to USD if we don’t have a custom mapping.
 */
export function getBandsForCountry(
  countryCode?: string | null
): SalaryBand[] {
  if (!countryCode) return USD_BANDS
  const cc = countryCode.toUpperCase() as CountryCode
  return COUNTRY_TO_BANDS[cc] ?? USD_BANDS
}

/**
 * Given a band key (like '200-299') and country, return min/max in local currency.
 * This is what you use to populate queryJobs({ minAnnual, maxAnnual, ... }).
 */
export function resolveBandRange(
  bandId: SalaryBandKey,
  countryCode?: string | null
): { min: number; max: number | null } | null {
  const bands = getBandsForCountry(countryCode)
  const band = bands.find((b) => b.id === bandId)
  if (!band) return null
  return { min: band.min, max: band.max }
}
