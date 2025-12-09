// Centralized site branding + canonical helpers
export const SITE_NAME = 'Six Figure Jobs'
export const DEFAULT_SITE_URL = 'https://6figjobs.com'

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL
}
