// lib/utils/number.ts
export function formatNumberCompact(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

/** "job" / "jobs" for a count: `${n} ${pluralize(n, 'job')}`. Pass the plural when it is not just an added "s". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural
}
