// lib/companies/logo.ts
// Build a logo URL with Clearbit fallback if no stored logo is available.

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

export function buildLogoUrl(
  logoUrl?: string | null,
  website?: string | null,
): string | null {
  if (logoUrl) return logoUrl

  const domain = extractDomain(website ?? null)
  if (!domain) return null

  // Prefer logo.dev (requires API key), fall back to Clearbit
  const logoDevKey = process.env.LOGODEV_API_KEY
  if (logoDevKey) {
    return `https://img.logo.dev/${domain}?apikey=${logoDevKey}`
  }

  // Clearbit logo endpoint – public, no token required for basic usage
  return `https://logo.clearbit.com/${domain}`
}
