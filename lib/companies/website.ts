import { detectAtsFromUrl } from '../normalizers/ats'
import { isKnownBoardHost } from '../scrapers/utils/boardHosts'

const SOCIAL_HOSTS = ['linkedin.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com']

const ATS_PORTAL_HOSTS = [
  // Hosted applicant-tracking / payroll career portals. Every employer on one of these shares the host, so it
  // is the vendor's address (and logo), not the employer's. Only the portal hosts are listed, not the vendors'
  // own sites (adp.com, paylocity.com, ukg.com, gusto.com are real employers' websites).
  'workforcenow.adp.com',
  'myjobs.adp.com',
  'recruiting.adp.com',
  'recruiting.paylocity.com',
  'ultipro.com',
  'ultipro.ca',
  'saashr.com',
  'mykronos.com',
  'ukg.net',
  'dayforcehcm.com',
  'entertimeonline.com',
  'recruitingbypaycor.com',
  'paycomonline.net',
  'jobs.gusto.com',
  'ats.rippling.com',
  'oraclecloud.com',
  'taleo.net',
  'successfactors.com',
  'successfactors.eu',
  'hr.cloud.sap',
  'myworkdaysite.com',
  'applytojob.com',
  'zohorecruit.com',
  'zohorecruit.eu',
  'jibeapply.com',
  'isolvedhire.com',
  'prismhr-hire.com',
  'primepay-recruit.com',
  'checkwritersrecruit.com',
  'oasisrecruit.com',
  'nexstarrecruiter.com',
  'exponentats.com',
  'hirehive.com',
  'hire.trakstar.com',
  'careers.hireology.com',
  'jobs.jobvite.com',
  'jobs.personio.com',
  'jobs.personio.de',
  'jobs.gem.com',
  'talent-soft.com',
  'careers.pageuppeople.com',
  'onlyfy.jobs',
  'app.beetween.com',
  'app.trinethire.com',
  'app.careerpuck.com',
  'app.dover.com',
  'app.loxo.co',
  'recruiterflow.com',
  'jobs.pyjamahr.com',
  'careers-page.com',
  'easyapply.co',
]

const INVALID_COMPANY_WEBSITE_HOSTS = [...SOCIAL_HOSTS, ...ATS_PORTAL_HOSTS]

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

/**
 * True for a job board, aggregator or hosted ATS / payroll portal: an address that belongs to many employers,
 * so a logo keyed to it is the vendor's. (Social sites are excluded: linkedin.com is LinkedIn's own address.)
 */
export function isJobPortalHost(host: string): boolean {
  const hostname = host.toLowerCase().replace(/^www\./, '')
  return (
    ATS_PORTAL_HOSTS.some((blocked) => hostMatches(hostname, blocked)) ||
    isKnownBoardHost(hostname) ||
    isGenericAtsHost(hostname)
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
  // A job board's own address is never the employer's website (it would show the board's logo and link).
  if (isKnownBoardHost(hostname)) return null
  if (detectAtsFromUrl(parsed.toString())) return null
  if (isGenericAtsHost(hostname)) return null

  parsed.hash = ''
  return parsed.toString().replace(/\/+$/, '')
}

export function isValidCompanyWebsite(rawUrl?: string | null): boolean {
  return Boolean(normalizePublicCompanyWebsite(rawUrl))
}
