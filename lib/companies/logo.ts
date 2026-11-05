// lib/companies/logo.ts
// Company logo URLs. Logos come from logo.dev, which needs a publishable key (LOGODEV_API_KEY).
//
// That key only exists on the server, but logos are also built inside client components (job cards, the
// company directory). A URL built with the key on the server and without it in the browser makes React drop
// the logo during hydration. So logos derived from a website or a name use same-origin URLs that carry no
// key (`/logo/domain/stripe.com`); the /logo route adds the key server-side and redirects to logo.dev.
import { normalizePublicCompanyWebsite } from './website'

const LOGO_DEV_HOST = 'img.logo.dev'
const LOGO_SIZE = '128' // the largest logo we draw is 72px, so this covers 2x screens
const DOMAIN_PATTERN = /^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i
const MAX_NAME_LENGTH = 80

function extractDomain(url?: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url.includes('://') ? url : `https://${url}`)
    const host = parsed.hostname.replace(/^www\./i, '')
    return host || null
  } catch {
    return null
  }
}

function appendLogoDevOptimization(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== LOGO_DEV_HOST) return url
    if (!parsed.searchParams.has('size')) parsed.searchParams.set('size', '64')
    if (!parsed.searchParams.has('format')) parsed.searchParams.set('format', 'webp')
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * The brand part of a company name, for a logo lookup. Recruiters and boards often append a description
 * ("Paragon Alpha - Hedge Fund Talent Business", "Acme | Careers", "Globex (UK) Ltd"); searching the full string
 * matches some other company, so only the part before the first separator is used.
 */
export function logoLookupName(name: string): string {
  const full = name.trim()
  const head = full.split(/\s[-\u2013\u2014|:]\s|\s\(/)[0].trim()
  return head.length >= 2 ? head : full
}

/** Same-origin logo URL, safe to build on the server and in the browser (no key). */
export function logoProxyUrl(kind: 'domain' | 'name', value: string): string {
  return `/logo/${kind}/${encodeURIComponent(value)}`
}

/**
 * Best logo URL for a company, or null.
 * Order: stored logo.dev URL, then logo.dev by website domain, then any other stored logo (for example a
 * BuiltIn CDN image), then logo.dev by company name. A stored Clearbit URL is replaced by logo.dev for its
 * domain, because Clearbit's logo API is no longer reliable.
 */
export function buildLogoUrl(
  logoUrl?: string | null,
  website?: string | null,
  name?: string | null,
): string | null {
  let storedOther: string | null = null

  if (logoUrl) {
    if (logoUrl.includes('logo.clearbit.com')) {
      // https://logo.clearbit.com/<company domain> — the company is in the path, not the host.
      const clearbitDomain = extractDomain(logoUrl.split('logo.clearbit.com/')[1]?.split(/[/?#]/)[0])
      if (clearbitDomain) return logoProxyUrl('domain', clearbitDomain)
    } else if (extractDomain(logoUrl) === LOGO_DEV_HOST) {
      return appendLogoDevOptimization(logoUrl)
    } else {
      storedOther = logoUrl
    }
  }

  const domain = extractDomain(normalizePublicCompanyWebsite(website ?? null))
  if (domain) return logoProxyUrl('domain', domain)

  if (storedOther) return storedOther

  const cleanName = logoLookupName(String(name ?? ''))
  if (cleanName && cleanName.length <= MAX_NAME_LENGTH) return logoProxyUrl('name', cleanName)

  return null
}

/** Free fallback when logo.dev has no logo (or no key is set): icon.horse returns a site's best icon, or a letter icon. */
export function buildFallbackLogoUrl(kind: string, value: string): string | null {
  if (kind !== 'domain') return null
  const domain = value.trim().toLowerCase()
  return DOMAIN_PATTERN.test(domain) ? `https://icon.horse/icon/${domain}` : null
}

/**
 * The logo.dev URL the /logo route redirects to, or null if the request is not valid. Needs the key.
 * `strict` makes logo.dev answer 404 when it has no logo, instead of drawing a generic letter, so the
 * route can fall through to the next source.
 */
export function buildLogoDevUrl(kind: string, value: string, token: string, strict = false): string | null {
  const key = token.trim()
  if (!key) return null

  const query = `token=${encodeURIComponent(key)}&size=${LOGO_SIZE}&format=webp${strict ? '&fallback=404' : ''}`

  if (kind === 'domain') {
    const domain = value.trim().toLowerCase()
    return DOMAIN_PATTERN.test(domain) ? `https://${LOGO_DEV_HOST}/${domain}?${query}` : null
  }

  if (kind === 'name') {
    const name = value.trim()
    return name && name.length <= MAX_NAME_LENGTH
      ? `https://${LOGO_DEV_HOST}/name/${encodeURIComponent(name)}?${query}`
      : null
  }

  return null
}
