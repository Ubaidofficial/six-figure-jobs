import {
  getAnnualSalaryCapForCurrency,
  normalizeSalary,
  type SalaryInterval,
} from '../normalizers/salary'
import type { ParsedSalary } from './greenhouseSalaryParser'

type StructuredSalary = {
  min: number | null
  max: number | null
  currency: string | null
  interval: string | SalaryInterval | null
}

function toAnnualMax(input: StructuredSalary | ParsedSalary | null): number | null {
  if (!input) return null
  const normalized = normalizeSalary({
    min: input.min,
    max: input.max,
    currency: input.currency,
    interval: input.interval,
  })
  const annual = normalized.maxAnnual ?? normalized.minAnnual
  if (annual == null) return null
  const n = Number(annual)
  return Number.isFinite(n) ? n : null
}

function isAnnualInterval(interval: string | SalaryInterval | null | undefined): boolean {
  const value = String(interval ?? '')
    .trim()
    .toLowerCase()
  return value === '' || value === 'year' || value === 'annual' || value === 'annually'
}

function amountsClose(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false
  const left = Math.abs(a)
  const right = Math.abs(b)
  const max = Math.max(left, right)
  if (max === 0) return true
  return Math.abs(left - right) / max <= 0.05
}

export function shouldPreferParsedGreenhouseSalary(input: {
  structured: StructuredSalary
  parsed: ParsedSalary | null
}): boolean {
  const { structured, parsed } = input
  if (!parsed) return false

  const hasStructuredValues = structured.min != null || structured.max != null
  if (!hasStructuredValues) return true

  const rawAmountsMatch =
    amountsClose(structured.min, parsed.min) &&
    amountsClose(structured.max ?? structured.min, parsed.max ?? parsed.min)

  const structuredAnnualMax = toAnnualMax(structured)
  const parsedAnnualMax = toAnnualMax(parsed)
  const cap = getAnnualSalaryCapForCurrency(parsed.currency ?? structured.currency)

  const structuredPeriodLooksWrong =
    !isAnnualInterval(structured.interval) && isAnnualInterval(parsed.interval)

  if (structuredPeriodLooksWrong && rawAmountsMatch) return true

  if (
    structuredPeriodLooksWrong &&
    structuredAnnualMax != null &&
    parsedAnnualMax != null &&
    parsedAnnualMax > 0 &&
    structuredAnnualMax >= parsedAnnualMax * 5
  ) {
    return true
  }

  if (
    structuredAnnualMax != null &&
    parsedAnnualMax != null &&
    structuredAnnualMax > cap &&
    parsedAnnualMax <= cap
  ) {
    return true
  }

  if (!structured.currency && parsed.currency && rawAmountsMatch) return true

  return false
}
