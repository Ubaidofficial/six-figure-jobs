// lib/companies/logoFallback.ts
// Deterministic initials + colour for a company with no usable logo, so the same company always
// looks the same wherever it appears.

/** Up to two letters: the first letters of the first two words ("Notion Labs" -> "NL", "Stripe" -> "S"). */
export function getInitials(name: string | null | undefined): string {
  const words = String(name ?? '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
  if (words.length === 0) return 'C'
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** Stable hue (0-359) derived from the name. */
export function fallbackHue(name: string | null | undefined): number {
  const text = String(name ?? '').trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash % 360
}
