// lib/utils/time.ts
// Compact relative time for job rows and cards: one style everywhere ("just now", "3h ago", "4d ago", "2mo ago",
// "1y ago"). Older posts used to fall back to `toLocaleDateString()` ("9/3/2026"), so one list mixed "4 days ago" with
// US-style dates.

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export function formatRelativeTime(
  input: Date | string | number | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!input) return null

  const date = input instanceof Date ? input : new Date(input)
  if (isNaN(date.getTime())) return null

  const diffMs = now - date.getTime()
  // Future dates and the last hour read as "just now".
  if (diffMs < HOUR) return 'just now'
  if (diffMs < DAY) return `${Math.floor(diffMs / HOUR)}h ago`

  const days = Math.floor(diffMs / DAY)
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}
