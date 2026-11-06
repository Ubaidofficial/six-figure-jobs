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

// Companies whose logo is white on a transparent background (logo.dev serves it that way), which is invisible
// on the usual white logo tile. They get a dark tile instead. Found by rendering the live company directory
// and looking for blank tiles; keyed by the first word of the company name, lowercased.
const DARK_TILE_COMPANIES = new Set(['okta', 'cesiumastro'])

export function needsDarkTile(name: string | null | undefined): boolean {
  const first = String(name ?? '').toLowerCase().split(/[^a-z0-9]+/).find(Boolean)
  return Boolean(first) && DARK_TILE_COMPANIES.has(first!)
}
