// lib/jobs/salaryThresholds.ts
//
// v2.9: Compatibility helpers (country -> currency -> canonical threshold).
// This module MUST NOT define its own threshold tables.

import { getHighSalaryThresholdAnnual } from '../currency/thresholds'
import { inferCurrencyFromCountryCode } from '../normalizers/salary'

export type SalaryThresholdInfo = {
  currency: string
  minAnnual: number
}

export function getCurrencyForCountry(
  countryCode: string | null | undefined
): string | null {
  if (!countryCode) return null
  return inferCurrencyFromCountryCode(countryCode)
}

export function getMinSalaryForCountry(
  countryCode: string | null | undefined
): number | null {
  if (!countryCode) return null
  const currency = inferCurrencyFromCountryCode(countryCode)
  return getHighSalaryThresholdAnnual(currency)
}

export function getSalaryThresholdInfoForCountry(
  countryCode: string | null | undefined
): SalaryThresholdInfo | null {
  if (!countryCode) return null
  const currency = inferCurrencyFromCountryCode(countryCode)
  const minAnnual = getHighSalaryThresholdAnnual(currency)
  if (!currency || minAnnual == null) return null
  return { currency, minAnnual }
}

export function isHighSalary(
  salaryAnnual: number,
  countryCode: string | null | undefined
): boolean {
  const threshold = getMinSalaryForCountry(countryCode)
  if (threshold == null) return false
  return salaryAnnual >= threshold
}

// Derived flags only (NOT eligibility): "very high" == 1.5x canonical threshold
export function isVeryHighSalary(
  salaryAnnual: number,
  countryCode: string | null | undefined
): boolean {
  const threshold = getMinSalaryForCountry(countryCode)
  if (threshold == null) return false
  return salaryAnnual >= threshold * 1.5
}
