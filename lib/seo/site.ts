// Centralized site branding + canonical helpers
export const SITE_NAME = 'Six Figure Jobs'
export const DEFAULT_SITE_URL = 'https://www.sixfigurejobs.net'

// Every host that serves this site. Page requests on any of them except the canonical one (getSiteUrl()) get a 301 to
// the same path on the canonical host (proxy.ts). 6figjobs.com was the canonical domain until the move to
// sixfigurejobs.net (2026-11-22); keep it here, and keep that domain renewed, for as long as old links exist.
export const SITE_HOSTS = ['www.sixfigurejobs.net', 'sixfigurejobs.net', 'www.6figjobs.com', '6figjobs.com'] as const

/** The host a page request should be sent to, or null when it is already there (or is not one of ours). */
export function canonicalHostFor(host: string, canonicalHost: string): string | null {
  const h = host.toLowerCase().replace(/:\d+$/, '')
  if (!(SITE_HOSTS as readonly string[]).includes(h)) return null
  return h === canonicalHost.toLowerCase() ? null : canonicalHost
}

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

/**
 * Default social preview image. A page that sets its own `openGraph` replaces the layout's whole openGraph object
 * (Next does not merge it), so every such page must pass `images` itself.
 */
export function defaultOgImages(alt = 'Six Figure Jobs: jobs that pay $100k+') {
  return [{ url: `${getSiteUrl()}/og-image.png`, width: 1200, height: 630, alt }]
}
