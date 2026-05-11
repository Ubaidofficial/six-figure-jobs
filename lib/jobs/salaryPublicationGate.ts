export const MIN_PUBLISHED_SALARY = 100_000

export type SalaryPublicationInput = {
  salaryMin?: number | bigint | null
  title?: string | null
  source?: string | null
}

function salaryToNumber(value: number | bigint | null | undefined): number | null {
  if (value == null) return null
  const numeric = typeof value === 'bigint' ? Number(value) : value
  return Number.isFinite(numeric) ? numeric : null
}

export function getMinimumSalaryRejection(input: SalaryPublicationInput): string | null {
  const salaryMin = salaryToNumber(input.salaryMin)
  if (salaryMin == null) return 'missing-salary-min'
  if (salaryMin < MIN_PUBLISHED_SALARY) return 'salary-min-below-100k'
  return null
}

export function warnMinimumSalaryRejected(input: SalaryPublicationInput, reason: string): void {
  console.warn(
    `[ingest] Rejecting job below $100k minimum salary gate reason=${reason} source=${input.source ?? 'unknown'} title="${input.title ?? 'unknown'}" salaryMin=${String(input.salaryMin ?? 'null')}`,
  )
}

