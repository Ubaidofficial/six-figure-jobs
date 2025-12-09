// lib/jobs/nlToFilters.ts

import type { JobQueryInput } from './queryJobs'
import { findMatchingRoles } from '../roles/synonyms'

const COUNTRY_KEYWORDS: Record<string, string[]> = {
  us: ['us', 'usa', 'united states', 'america'],
  gb: ['uk', 'gb', 'united kingdom', 'britain', 'england'],
  ca: ['canada', 'ca'],
  de: ['germany', 'de', 'berlin'],
  ie: ['ireland', 'ie'],
  ch: ['switzerland', 'ch'],
  sg: ['singapore', 'sg'],
  au: ['australia', 'au'],
  nz: ['new zealand', 'nz'],
}


const SENIORITY_KEYWORDS: Record<string, string[]> = {
  entry: ['entry', 'junior', 'jr', 'associate'],
  mid: ['mid', 'midlevel', 'mid-level'],
  senior: ['senior', 'sr'],
  lead: ['lead', 'staff', 'principal', 'staff+'],
  executive: ['director', 'vp', 'c-suite', 'cto', 'chief', 'head of'],
}

export function parseSearchQuery(
  input: string,
): Partial<JobQueryInput> {
  if (!input) return {}

  const text = input.toLowerCase()
  const filters: Partial<JobQueryInput> = {}

  // Salary: pick the highest number that looks like $XYZk
  const salaryMatches = [...text.matchAll(/\$?\s*(\d{2,3})\s*k/g)]
  if (salaryMatches.length > 0) {
    const max = Math.max(...salaryMatches.map((m) => Number(m[1]) * 1000))
    if (Number.isFinite(max) && max >= 100_000) {
      filters.minAnnual = max
    }
  }

  // Remote / hybrid / onsite
  if (/\bon[-\s]?site\b/.test(text)) {
    filters.remoteMode = 'onsite'
  } else if (/\bhybrid\b/.test(text)) {
    filters.remoteMode = 'hybrid'
  } else if (/\bremote\b/.test(text) || /\banywhere\b/.test(text)) {
    filters.remoteOnly = true
    filters.remoteMode = 'remote'
  }

  // Remote region
  if (/\bapac\b/.test(text)) filters.remoteRegion = 'apac'
  if (/\bemea\b/.test(text)) filters.remoteRegion = 'emea'
  if (/\b(us only|us-only)\b/.test(text)) filters.remoteRegion = 'us-only'
  if (/\bglobal\b/.test(text) || /\banywhere\b/.test(text)) filters.remoteRegion = 'global'

  // Countries
  for (const [code, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      filters.countryCode = code.toUpperCase()
      break
    }
  }

  // Roles - Use our comprehensive role synonyms system
  const matchedRoles = findMatchingRoles(text)
  if (matchedRoles.length > 0) {
    filters.roleSlugs = matchedRoles
  }

  // Seniority
  for (const [level, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      filters.experienceLevel = level
      break
    }
  }

  // Contract
  if (/\bcontract\b/.test(text) || /\bfreelance\b/.test(text)) {
    filters.employmentTypes = ['contract']
  }

  return filters
}
