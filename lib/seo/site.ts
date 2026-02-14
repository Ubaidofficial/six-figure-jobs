// Centralized site branding + canonical helpers
export const SITE_NAME = 'Six Figure Jobs'
export const DEFAULT_SITE_URL = 'https://www.6figjobs.com'

function normalizeBaseUrl(input: string): string {
  const raw = String(input || '').trim()
  if (!raw) return DEFAULT_SITE_URL

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

  try {
    const url = new URL(withScheme)
    return `${url.protocol}//${url.host}`.replace(/\/+$/, '')
  } catch {
    return DEFAULT_SITE_URL
  }
}

export function getSiteUrl(): string {
  // Canonical policy:
  // 1) Explicit server runtime URL override (useful for local validation)
  // 2) Explicit public site URL (production canonical)
  // 3) Railway domain fallback (preview/runtime convenience)
  // 4) Hardcoded default
  const explicit = process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    return normalizeBaseUrl(explicit)
  }

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim()
  if (railwayDomain) {
    return normalizeBaseUrl(railwayDomain)
  }

  return DEFAULT_SITE_URL
}
