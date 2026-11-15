// lib/companies/websiteFromApplyUrls.ts
//
// A company with no stored website often has live jobs whose apply links point at the employer's own domain
// ("https://careers.acme.com/jobs/123"). When every usable apply link of a company names one employer domain, that domain is
// the company's website: scripts/backfill-company-websites.ts fills the EMPTY ones. A wrong website puts a wrong logo and
// organisation URL into the job pages' structured data (lib/seo/jobJsonLd.ts), so this is strict:
//  - job boards, hosted ATS / payroll portals, LinkedIn and other social hosts never count (isJobPortalHost, detectAtsFromUrl);
//  - a leading career-site label ("careers.", "jobs.", "apply."...) is dropped: servicenow.com, not careers.servicenow.com;
//  - the links must name exactly ONE host, and the host must look like the company (nameMatchesHost) or be named by at least
//    three jobs. Anything else is left empty. Pure.
import { detectAtsFromUrl } from '../normalizers/ats'
import { isJobPortalHost } from './website'

const SOCIAL = /(^|\.)(?:linkedin|facebook|instagram|twitter|x|youtube|tiktok|glassdoor|indeed)\.com$/i
const CAREER_LABEL = /^(?:careers?|jobs?|apply|join|work|talent|hire|hiring|recruiting|recruit|employment|opportunities|boards?)\./
const COMPANY_SUFFIX = /\b(?:inc|incorporated|llc|ltd|limited|gmbh|ag|corp|corporation|co|company|plc|sa|bv|pty|holdings?)\b\.?/g

/** The employer domain an apply link points to ("careers.acme.com" -> "acme.com"), or null when it is a portal, a board, a social site or not a domain. */
export function employerHostFromApplyUrl(url: string | null | undefined): string | null {
  if (!url) return null
  // "mailto:jobs@acme.com", "tel:..." and "javascript:..." are not web addresses ("acme.com:8080" is).
  if (/^[a-z][a-z0-9+.-]*:(?!\/\/|\d)/i.test(url.trim())) return null
  let parsed: URL
  try {
    parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
  } catch {
    return null
  }
  if (!/^https?:$/.test(parsed.protocol) || parsed.username) return null
  let host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) || /^\d+(?:\.\d+){3}$/.test(host)) return null
  if (SOCIAL.test(host) || isJobPortalHost(host) || detectAtsFromUrl(parsed.toString())) return null
  host = host.replace(CAREER_LABEL, '')
  if (!host.includes('.') || isJobPortalHost(host)) return null
  return host
}

const key = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(COMPANY_SUFFIX, ' ').replace(/[^a-z0-9]+/g, '')

/** Does the domain's name look like the company's name ("Datadog" ~ datadoghq.com, "Scale AI" ~ scale.com)? Both at least four letters. */
export function nameMatchesHost(companyName: string, host: string): boolean {
  const name = key(companyName)
  const label = host.split('.')[0].replace(/[^a-z0-9]/g, '')
  if (name.length < 4 || label.length < 4) return false
  return name.includes(label) || label.includes(name)
}

export type WebsitePick =
  | { ok: true; website: string; jobs: number; nameMatch: boolean }
  | { ok: false; reason: 'no-employer-link' | 'several-domains' | 'not-enough-evidence'; hosts: string[] }

/** The website to fill for a company with no stored one, from its jobs' apply links; or why not. */
export function pickCompanyWebsite(companyName: string, applyUrls: ReadonlyArray<string | null | undefined>): WebsitePick {
  const counts = new Map<string, number>()
  for (const url of applyUrls) {
    const host = employerHostFromApplyUrl(url)
    if (host) counts.set(host, (counts.get(host) ?? 0) + 1)
  }
  const hosts = [...counts.keys()]
  if (!hosts.length) return { ok: false, reason: 'no-employer-link', hosts }
  if (hosts.length > 1) return { ok: false, reason: 'several-domains', hosts }
  const host = hosts[0]
  const jobs = counts.get(host)!
  const nameMatch = nameMatchesHost(companyName, host)
  if (!nameMatch && jobs < 3) return { ok: false, reason: 'not-enough-evidence', hosts }
  return { ok: true, website: `https://${host}`, jobs, nameMatch }
}
