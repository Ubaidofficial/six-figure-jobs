/**
 * Normalize raw location strings for deterministic regex classification.
 *
 * Fix 2: treat "•" as a real list separator (Greenhouse often uses bullets).
 * Also keep: commas, semicolons, pipes, slashes. Collapse whitespace.
 */
export function normalizeLocationRaw(raw?: string | null): string {
  const s = (raw ?? '').toLowerCase()
  return s
    .replace(/•/g, '|')                  // Fix 2
    .replace(/[^a-z0-9,;|/]+/g, ' ')     // keep separators
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Fix 1: multi-location detection should NOT treat "City, State, Country"
 * as multi. Only count comma-lists as multi when there are MANY segments.
 *
 * Regex means: at least 3 commas -> 4+ comma-separated segments
 */
export function hasMultiLocationSignals(lr: string): boolean {
  if (!lr) return false
  return (
    /(multiple locations|various locations|any of)/.test(lr) ||
    /[;|/]/.test(lr) ||
    /([^,]+,){3,}[^,]+/.test(lr)         // Fix 1
  )
}
