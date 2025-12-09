// lib/scrapers/helpers/salaryFlags.ts
import { getMinSalaryForCountry, isVeryHighSalary } from '../../jobs/salaryThresholds'

/**
 * Calculate high salary flags for a job
 * @param minAnnual - Minimum annual salary
 * @param countryCode - ISO country code
 * @returns Object with isHundredKLocal and isHighSalaryLocal
 */
export function calculateSalaryFlags(
  minAnnual: number | bigint | null | undefined,
  countryCode: string | null | undefined
): {
  isHundredKLocal: boolean
  isHighSalaryLocal: boolean
} {
  if (!minAnnual || !countryCode) {
    return {
      isHundredKLocal: false,
      isHighSalaryLocal: false,
    }
  }

  const salaryNum = typeof minAnnual === 'bigint' ? Number(minAnnual) : minAnnual
  const threshold = getMinSalaryForCountry(countryCode)
  const isHundredKLocal = salaryNum >= threshold
  const isHighSalaryLocal = isVeryHighSalary(salaryNum, countryCode)

  return {
    isHundredKLocal,
    isHighSalaryLocal,
  }
}