// lib/utils/time.ts
// Lightweight relative time formatter for UI badges

export function formatRelativeTime(
  input: Date | string | number | null | undefined,
): string | null {
  if (!input) return null

  const date = input instanceof Date ? input : new Date(input)
  if (isNaN(date.getTime())) return null

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  // Future dates – treat as "Just now"
  if (diffSec < 0) return 'Just now'
  if (diffSec < 60) return 'Just now'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  // Fallback to date for older posts
  return date.toLocaleDateString()
}
