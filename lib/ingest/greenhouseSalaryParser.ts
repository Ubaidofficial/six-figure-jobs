// lib/ingest/greenhouseSalaryParser.ts
// Parses salary from Greenhouse job description HTML

export interface ParsedSalary {
  min: number
  max: number
  currency: string
}

/**
 * Decode HTML entities
 */
function decodeHtml(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
}

/**
 * Parse number from salary string, handling both US (commas) and EU (dots) formats
 */
function parseNumber(str: string): number {
  // European format: 155.000 (dot as thousands separator)
  if (/^\d{1,3}\.\d{3}$/.test(str)) {
    return parseInt(str.replace('.', ''), 10)
  }
  // US format: 155,000 (comma as thousands separator)
  return parseInt(str.replace(/[,\.]/g, ''), 10)
}

/**
 * Parse salary from Greenhouse job description HTML
 * 
 * Looks for patterns like:
 * - <span>$230,000</span>...<span>$300,000 USD</span>
 * - <span>€155.000</span>...<span>€205.000 EUR</span>
 * - <span>£240,000</span>...<span>£325,000 GBP</span>
 */
export function parseGreenhouseSalary(html: string | null | undefined): ParsedSalary | null {
  if (!html) return null

  const decoded = decodeHtml(html)

  // Pattern: pay-range div containing salary spans (using [\s\S] instead of . with s flag)
  const match = decoded.match(
    /pay-range[\s\S]*?<span>([£$€])([\d.,]+)<\/span>[\s\S]*?<span>([£$€])?([\d.,]+)\s*(USD|EUR|GBP|AUD|CAD)?<\/span>/
  )

  if (!match) return null

  const symbol = match[1]
  const minStr = match[2]
  const maxStr = match[4]
  const currencyCode = match[5]

  const min = parseNumber(minStr)
  const max = parseNumber(maxStr)

  // Determine currency from symbol or explicit code
  let currency = 'USD'
  if (currencyCode) {
    currency = currencyCode
  } else if (symbol === '£') {
    currency = 'GBP'
  } else if (symbol === '€') {
    currency = 'EUR'
  }

  // Validate reasonable salary range
  if (min < 30000 || max > 2000000 || min > max) {
    return null
  }

  return { min, max, currency }
}

/**
 * Check if salary is high-paying based on currency thresholds
 */
export function isHighSalary(salary: ParsedSalary): boolean {
  const thresholds: Record<string, number> = {
    USD: 90000,
    EUR: 90000,
    GBP: 75000,
    AUD: 100000,
    CAD: 100000,
    CHF: 100000,
  }
  return salary.min >= (thresholds[salary.currency] || 90000)
}
