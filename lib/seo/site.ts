// Centralized site branding + canonical helpers
export const SITE_NAME = 'Six Figure Jobs'
export const DEFAULT_SITE_URL = 'https://www.6figjobs.com'

export function getSiteUrl(): string {
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim()
  if (railwayDomain) {
    return `https://${railwayDomain}`.replace(/\/+$/, '')
  }

  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(
    /\/+$/,
    '',
  )
}
