// lib/alerts/filters.ts
// What an alert searches for: a whitelisted subset of the listing page's own JobQueryInput, so the email contains
// exactly the jobs that page would list (the digest runs it through the same buildWhere). Filters arrive from the
// browser, so every field is checked here; anything else is dropped.
//
// The alert's name ("Senior Software Engineer jobs · Remote · $150K+") is always built here from the checked filters,
// never taken from the browser: it goes into emails we send to an address someone typed, so it must not carry text of
// their choosing beyond a short, plain search keyword.

import type { JobQueryInput } from '@/lib/jobs/queryJobs'
import { REMOTE_REGIONS } from '@/lib/jobs/remoteRegions'
import { countryName } from '@/lib/location/country'
import { roleLabelFor } from '@/lib/roles/relatedRoles'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'

export type AlertFilters = Pick<
  JobQueryInput,
  | 'roleSlugs'
  | 'skillSlugs'
  | 'countryCode'
  | 'remoteOnly'
  | 'remoteMode'
  | 'remoteRegion'
  | 'seniorityLevels'
  | 'companySizeBuckets'
  | 'tech'
  | 'keyword'
  | 'visaSponsorship'
  | 'currency'
  | 'minAnnual'
  | 'maxAnnual'
>

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/
const SHORT = /^[a-z0-9+][a-z0-9+-]{0,19}$/
const TECH = /^[a-z0-9+#.][a-z0-9+#. -]{0,39}$/i
// Letters (any language), digits, spaces and the few symbols job searches use (c++, c#, node.js, r&d, ui/ux).
const KEYWORD = /^[\p{L}\p{N}][\p{L}\p{N} +#.&/-]{0,59}$/u
const REGIONS = new Set(REMOTE_REGIONS.map((r) => r.slug))

const slugList = (v: unknown, re: RegExp, max: number): string[] | undefined => {
  if (!Array.isArray(v)) return undefined
  const out = [...new Set(v.filter((s): s is string => typeof s === 'string' && re.test(s)))].slice(0, max).sort()
  return out.length ? out : undefined
}

const money = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 10_000_000 ? v : undefined

/** A link or an address has no place in a job search, and would turn the confirmation email into a carrier for one. */
const looksLikeLink = (s: string) => /(https?|www\.|\.(com|net|org|io|ru|xyz|info|top|co)\b|@)/i.test(s)

/** The browser's filters (any JSON) to the alert's filters, or null when nothing valid is left to search for. */
export function sanitizeAlertFilters(raw: unknown): AlertFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const f: AlertFilters = {}

  f.roleSlugs = slugList(r.roleSlugs, SLUG, 5)
  f.skillSlugs = slugList(r.skillSlugs, SLUG, 5)
  f.seniorityLevels = slugList(r.seniorityLevels, SHORT, 6)
  f.companySizeBuckets = slugList(r.companySizeBuckets, SHORT, 6)
  if (typeof r.countryCode === 'string' && /^[A-Z]{2}$/.test(r.countryCode)) f.countryCode = r.countryCode
  if (r.remoteMode === 'remote' || r.remoteMode === 'hybrid' || r.remoteMode === 'onsite') f.remoteMode = r.remoteMode
  if (r.remoteOnly === true) f.remoteOnly = true
  if (typeof r.remoteRegion === 'string' && REGIONS.has(r.remoteRegion)) f.remoteRegion = r.remoteRegion
  if (typeof r.tech === 'string' && TECH.test(r.tech.trim()) && !looksLikeLink(r.tech)) f.tech = r.tech.trim().toLowerCase()
  if (typeof r.keyword === 'string') {
    const k = r.keyword.trim().replace(/\s+/g, ' ')
    if (KEYWORD.test(k) && !looksLikeLink(k)) f.keyword = k.toLowerCase()
  }
  if (r.visaSponsorship === true) f.visaSponsorship = true
  if (typeof r.currency === 'string' && /^[A-Z]{3}$/.test(r.currency)) f.currency = r.currency
  f.minAnnual = money(r.minAnnual)
  f.maxAnnual = money(r.maxAnnual)
  if (f.minAnnual && f.maxAnnual && f.maxAnnual < f.minAnnual) f.maxAnnual = undefined
  if (!f.minAnnual && !f.maxAnnual) f.currency = undefined

  // Undefined keys out, so the stored JSON and its key are canonical.
  const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as AlertFilters
  return clean
}

/** Canonical text of the filters (sorted keys): the same search always gives the same key. */
export function alertFiltersKey(f: AlertFilters): string {
  return JSON.stringify(Object.fromEntries(Object.entries(f).sort(([a], [b]) => a.localeCompare(b))))
}

const SENIORITY_WORDS: Record<string, string> = {
  entry: 'Entry-level',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff',
  principal: 'Principal',
  lead: 'Lead',
  director: 'Director',
  vp: 'VP',
}

const titleCase = (s: string) => s.replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase())

/** "Senior Software Engineer jobs · Remote (Europe) · $150K+". Plain text; callers escape it for HTML. */
export function buildAlertLabel(f: AlertFilters): string {
  const seniority = f.seniorityLevels?.length === 1 ? SENIORITY_WORDS[f.seniorityLevels[0]] ?? null : null
  let what = 'Six-figure'
  if (f.roleSlugs?.length) {
    what = roleLabelFor(f.roleSlugs[0]) + (f.roleSlugs.length > 1 ? ` +${f.roleSlugs.length - 1}` : '')
  } else if (f.keyword) {
    what = `“${f.keyword}”`
  } else if (f.tech) {
    what = titleCase(f.tech)
  } else if (f.skillSlugs?.length) {
    what = roleLabelFor(f.skillSlugs[0])
  }

  const details: string[] = []
  const region = f.remoteRegion ? REMOTE_REGIONS.find((r) => r.slug === f.remoteRegion) : null
  if (region) details.push(`Remote (${region.label})`)
  else if (f.remoteMode) details.push(titleCase(f.remoteMode === 'onsite' ? 'on-site' : f.remoteMode))
  else if (f.remoteOnly) details.push('Remote')
  if (f.countryCode) details.push(countryName(f.countryCode, { short: true }) ?? f.countryCode)
  if (f.minAnnual) {
    const top = f.maxAnnual ? `–${formatCurrencyShort(f.maxAnnual, f.currency ?? 'USD')}` : '+'
    details.push(`${formatCurrencyShort(f.minAnnual, f.currency ?? 'USD')}${top}`)
  }
  if (f.visaSponsorship) details.push('Visa sponsorship')

  return [`${seniority ? `${seniority} ` : ''}${what} jobs`, ...details].join(' · ')
}

/** The filters as the job query takes them, with the defaults queryJobs applies to every listing. */
export function alertQueryInput(f: AlertFilters): JobQueryInput {
  return { ...f, excludeInternships: true }
}
