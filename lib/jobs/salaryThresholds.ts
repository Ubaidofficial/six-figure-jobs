// lib/jobs/salaryThresholds.ts
/**
 * PPP-Adjusted Salary Thresholds by Country
 * 
 * Each country has its own threshold based on:
 * - Purchasing Power Parity (PPP)
 * - Cost of living
 * - Local salary standards
 * - Top 20% earners in that country
 */

export interface SalaryThreshold {
  currency: string
  minAnnual: number
  description: string
  percentile: string
}

export const SALARY_THRESHOLDS_BY_COUNTRY: Record<string, SalaryThreshold> = {
  // North America
  'US': {
    currency: 'USD',
    minAnnual: 100000,
    description: 'Six figures',
    percentile: 'Top 20%'
  },
  'CA': {
    currency: 'CAD',
    minAnnual: 100000,
    description: 'Six figures CAD',
    percentile: 'Top 20%'
  },
  
  // Europe
  'GB': {
    currency: 'GBP',
    minAnnual: 75000,
    description: 'High professional salary',
    percentile: 'Top 15%'
  },
  'IE': {
    currency: 'EUR',
    minAnnual: 85000,
    description: 'High professional salary',
    percentile: 'Top 15%'
  },
  'DE': {
    currency: 'EUR',
    minAnnual: 80000,
    description: 'High professional salary',
    percentile: 'Top 20%'
  },
  'NL': {
    currency: 'EUR',
    minAnnual: 85000,
    description: 'High professional salary',
    percentile: 'Top 18%'
  },
  'CH': {
    currency: 'CHF',
    minAnnual: 110000,
    description: 'High professional salary',
    percentile: 'Top 25%'
  },
  'FR': {
    currency: 'EUR',
    minAnnual: 75000,
    description: 'High professional salary',
    percentile: 'Top 18%'
  },
  'ES': {
    currency: 'EUR',
    minAnnual: 65000,
    description: 'High professional salary',
    percentile: 'Top 12%'
  },
  'PT': {
    currency: 'EUR',
    minAnnual: 60000,
    description: 'High professional salary',
    percentile: 'Top 10%'
  },
  'PL': {
    currency: 'PLN',
    minAnnual: 250000,
    description: 'High professional salary',
    percentile: 'Top 10%'
  },
  
  // Asia-Pacific
  'AU': {
    currency: 'AUD',
    minAnnual: 140000,
    description: 'High professional salary',
    percentile: 'Top 15%'
  },
  'NZ': {
    currency: 'NZD',
    minAnnual: 120000,
    description: 'High professional salary',
    percentile: 'Top 15%'
  },
  'SG': {
    currency: 'SGD',
    minAnnual: 120000,
    description: 'High professional salary',
    percentile: 'Top 20%'
  },
  'IN': {
    currency: 'INR',
    minAnnual: 3500000,
    description: 'Top tech/startup salary',
    percentile: 'Top 5%'
  },
  'JP': {
    currency: 'JPY',
    minAnnual: 10000000,
    description: 'High professional salary',
    percentile: 'Top 15%'
  },
  'KR': {
    currency: 'KRW',
    minAnnual: 80000000,
    description: 'High professional salary',
    percentile: 'Top 18%'
  },
  
  // Middle East
  'AE': {
    currency: 'AED',
    minAnnual: 300000,
    description: 'High professional salary',
    percentile: 'Top 20%'
  },
  
  // South America
  'BR': {
    currency: 'BRL',
    minAnnual: 250000,
    description: 'Top professional salary',
    percentile: 'Top 8%'
  },
  'MX': {
    currency: 'MXN',
    minAnnual: 800000,
    description: 'Top professional salary',
    percentile: 'Top 10%'
  },
}

/**
 * Get minimum salary threshold for a country
 * @param countryCode - ISO country code (e.g., 'US', 'GB')
 * @returns Minimum annual salary in local currency
 */
export function getMinSalaryForCountry(countryCode: string): number {
  const threshold = SALARY_THRESHOLDS_BY_COUNTRY[countryCode.toUpperCase()]
  return threshold?.minAnnual || 100000 // Default to USD $100k
}

/**
 * Get currency for a country
 * @param countryCode - ISO country code
 * @returns Currency code (e.g., 'USD', 'GBP')
 */
export function getCurrencyForCountry(countryCode: string): string {
  const threshold = SALARY_THRESHOLDS_BY_COUNTRY[countryCode.toUpperCase()]
  return threshold?.currency || 'USD'
}

/**
 * Check if a salary meets the high-paying threshold for its country
 * @param salary - Annual salary
 * @param countryCode - ISO country code
 * @returns True if salary meets or exceeds local threshold
 */
export function isHighSalary(salary: number, countryCode: string): boolean {
  const threshold = getMinSalaryForCountry(countryCode)
  return salary >= threshold
}

/**
 * Check if a salary is "very high" (1.5x threshold)
 * @param salary - Annual salary
 * @param countryCode - ISO country code
 * @returns True if salary is 1.5x+ local threshold
 */
export function isVeryHighSalary(salary: number, countryCode: string): boolean {
  const threshold = getMinSalaryForCountry(countryCode)
  return salary >= threshold * 1.5
}

/**
 * Check if a salary is "elite" (2x threshold)
 * @param salary - Annual salary
 * @param countryCode - ISO country code
 * @returns True if salary is 2x+ local threshold
 */
export function isEliteSalary(salary: number, countryCode: string): boolean {
  const threshold = getMinSalaryForCountry(countryCode)
  return salary >= threshold * 2
}

/**
 * Check if a salary is "top 1%" (3x threshold)
 * @param salary - Annual salary
 * @param countryCode - ISO country code
 * @returns True if salary is 3x+ local threshold
 */
export function isTop1PercentSalary(salary: number, countryCode: string): boolean {
  const threshold = getMinSalaryForCountry(countryCode)
  return salary >= threshold * 3
}

/**
 * Get salary tier badge
 * @param salary - Annual salary
 * @param countryCode - ISO country code
 * @returns Badge info object
 */
export function getSalaryTier(salary: number, countryCode: string): {
  tier: 'high' | 'very-high' | 'elite' | 'top-1'
  label: string
  color: string
} {
  if (isTop1PercentSalary(salary, countryCode)) {
    return { tier: 'top-1', label: 'Top 1%', color: 'red' }
  }
  if (isEliteSalary(salary, countryCode)) {
    return { tier: 'elite', label: 'Elite', color: 'purple' }
  }
  if (isVeryHighSalary(salary, countryCode)) {
    return { tier: 'very-high', label: 'Very High', color: 'blue' }
  }
  return { tier: 'high', label: 'High-Paying', color: 'green' }
}

/**
 * Format currency symbol
 * @param currency - Currency code (e.g., 'USD', 'GBP')
 * @returns Currency symbol (e.g., '$', '£')
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'CAD': 'C$',
    'GBP': '£',
    'EUR': '€',
    'CHF': 'CHF ',
    'AUD': 'A$',
    'NZD': 'NZ$',
    'SGD': 'S$',
    'INR': '₹',
    'JPY': '¥',
    'KRW': '₩',
    'AED': 'AED ',
    'BRL': 'R$',
    'MXN': 'MX$',
    'PLN': 'zł',
  }
  
  return symbols[currency] || currency + ' '
}

export default SALARY_THRESHOLDS_BY_COUNTRY