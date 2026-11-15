// lib/companies/profileFromSite.ts
//
// What a company's own homepage says about the company, for free: its meta description and, when the page publishes one, its
// schema.org `Organization` data (founding date, number of employees, LinkedIn link, country). Nothing is guessed: a field is
// returned only when the page states it. Used by scripts/measureCompanyProfiles.ts to measure how many of our companies this
// can fill before anything is written. Pure.
import * as cheerio from 'cheerio/slim'

export type SiteProfile = {
  description?: string
  foundingYear?: number
  employeeMin?: number
  employeeMax?: number
  linkedinUrl?: string
  country?: string
}

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()
const MIN_DESCRIPTION_CHARS = 50
const MAX_DESCRIPTION_CHARS = 500

function organizations(html: string): any[] {
  const $ = cheerio.load(html)
  const found: any[] = []
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const data = JSON.parse($(el).contents().text())
      const nodes = Array.isArray(data) ? data : Array.isArray(data?.['@graph']) ? data['@graph'] : [data]
      for (const node of nodes) {
        const type = ([] as string[]).concat(node?.['@type'] ?? []).join(' ')
        if (/\b(?:Organization|Corporation|LocalBusiness|NGO)\b/.test(type)) found.push(node)
      }
    } catch {
      /* not JSON */
    }
  })
  return found
}

export function parseSiteProfile(html: string): SiteProfile {
  const $ = cheerio.load(html)
  const profile: SiteProfile = {}

  const orgs = organizations(html)
  const candidates = [
    clean($('meta[name="description"]').attr('content')),
    clean($('meta[property="og:description"]').attr('content')),
    clean($('meta[name="twitter:description"]').attr('content')),
    ...orgs.map((o) => clean(o?.description)),
  ].filter((d) => d.length >= MIN_DESCRIPTION_CHARS)
  const best = candidates.sort((a, b) => b.length - a.length)[0]
  if (best) profile.description = best.length > MAX_DESCRIPTION_CHARS ? `${best.slice(0, MAX_DESCRIPTION_CHARS - 1).trimEnd()}…` : best

  for (const org of orgs) {
    const year = Number(String(org?.foundingDate ?? '').match(/\b(1[89]\d\d|20[0-3]\d)\b/)?.[1])
    if (year && !profile.foundingYear) profile.foundingYear = year

    const n = org?.numberOfEmployees
    const min = Number(typeof n === 'object' && n ? (n.minValue ?? n.value) : n)
    const max = Number(typeof n === 'object' && n ? (n.maxValue ?? n.value) : n)
    if (Number.isFinite(min) && min > 0 && !profile.employeeMin) {
      profile.employeeMin = min
      profile.employeeMax = Number.isFinite(max) && max >= min ? max : min
    }

    const linkedin = ([] as string[]).concat(org?.sameAs ?? []).find((u) => /^https?:\/\/(?:[a-z]+\.)?linkedin\.com\/company\//i.test(String(u)))
    if (linkedin && !profile.linkedinUrl) profile.linkedinUrl = String(linkedin).split('?')[0]

    const country = clean(typeof org?.address === 'object' ? org.address?.addressCountry?.name ?? org.address?.addressCountry : '')
    if (country && country.length <= 60 && !profile.country) profile.country = country
  }
  return profile
}
