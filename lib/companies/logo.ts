// lib/companies/logo.ts
// Build a logo URL. Prefer stored logo.dev URLs and avoid Clearbit fallbacks
// because failed Clearbit requests are reported as console errors by Lighthouse.
import { normalizePublicCompanyWebsite } from './website'

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
    if (parsed.hostname !== 'img.logo.dev') return url
    if (!parsed.searchParams.has('size')) parsed.searchParams.set('size', '64')
    if (!parsed.searchParams.has('format')) parsed.searchParams.set('format', 'webp')
    return parsed.toString()
  } catch {
    return url
  }
}

export function buildLogoUrl(
  logoUrl?: string | null,
  website?: string | null,
): string | null {
  if (logoUrl) {
    if (logoUrl.includes('logo.clearbit.com')) {
      const clearbitDomain = extractDomain(logoUrl)
      const logoDevKey = process.env.LOGODEV_API_KEY
      return clearbitDomain && logoDevKey
        ? appendLogoDevOptimization(`https://img.logo.dev/${clearbitDomain}?apikey=${logoDevKey}`)
        : null
    }

    return appendLogoDevOptimization(logoUrl)
  }

  const publicWebsite = normalizePublicCompanyWebsite(website ?? null)
  const domain = extractDomain(publicWebsite)
  if (!domain) return null

  // Prefer logo.dev when configured. Otherwise use the initials fallback.
  const logoDevKey = process.env.LOGODEV_API_KEY
  if (logoDevKey) {
    return appendLogoDevOptimization(`https://img.logo.dev/${domain}?apikey=${logoDevKey}`)
  }

  return null
}
