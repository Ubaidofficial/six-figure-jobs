import { detectAtsFromUrl } from '../normalizers/ats'

const INVALID_COMPANY_WEBSITE_HOSTS = [
  'linkedin.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
]

function hostMatches(hostname: string, blockedHost: string): boolean {
  return hostname === blockedHost || hostname.endsWith(`.${blockedHost}`)
}

function isGenericAtsHost(hostname: string): boolean {
  return (
    hostname === 'boards.greenhouse.io' ||
    hostname === 'job-boards.greenhouse.io' ||
    /^job-boards\.[a-z0-9-]+\.greenhouse\.io$/.test(hostname) ||
    hostname === 'grnh.se' ||
    hostname === 'jobs.ashbyhq.com' ||
    hostname === 'jobs.lever.co' ||
    hostname === 'apply.workable.com' ||
    hostname === 'jobs.smartrecruiters.com' ||
    hostname === 'careers.smartrecruiters.com'
  )
}

export function normalizePublicCompanyWebsite(rawUrl?: string | null): string | null {
  if (!rawUrl) return null

  const normalizedInput = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
    ? rawUrl
    : `https://${rawUrl}`

  let parsed: URL
  try {
    parsed = new URL(normalizedInput)
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return null
  const hostname = parsed.hostname.toLowerCase()
  if (INVALID_COMPANY_WEBSITE_HOSTS.some((host) => hostMatches(hostname, host))) return null
  if (detectAtsFromUrl(parsed.toString())) return null
  if (isGenericAtsHost(hostname)) return null

  parsed.hash = ''
  return parsed.toString().replace(/\/+$/, '')
}

export function isValidCompanyWebsite(rawUrl?: string | null): boolean {
  return Boolean(normalizePublicCompanyWebsite(rawUrl))
}
