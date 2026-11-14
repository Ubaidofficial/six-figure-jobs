// lib/companies/profileFill.ts
//
// Decides what to write into a company's EMPTY profile fields from free sources (scripts/fill-company-profiles.ts). Pure.
//
//  - foundedYear: the company's own page when it states one (schema.org), else Wikidata (matched by official website);
//  - linkedinUrl: only a linkedin.com/company/ link the company's own page publishes;
//  - description: the page's meta description is usually a marketing tagline ("Success Starts With The Right Match"), so a
//    free model is asked to restate it neutrally, and the answer is kept only when it adds nothing the tagline did not say
//    (validateCompanyDescription). No tagline, no description.
// Nothing here overwrites a stored value: a field is in the plan only when it is empty today.
import { isKnownBoardHost } from '../scrapers/utils/boardHosts'
import { isJobPortalHost } from './website'
import type { SiteProfile } from './profileFromSite'
import type { WikidataProfile } from './wikidataProfile'

export type CompanyProfileNow = { foundedYear: number | null; linkedinUrl: string | null; description: string | null }

export type ProfilePlan = {
  foundedYear?: { value: number; source: 'site' | 'wikidata' }
  linkedinUrl?: { value: string; source: 'site' }
  /** The tagline to restate; not yet a description. */
  taglineForDescription?: string
}

/**
 * "https://harness.io/" for a company website, or null when it is a job board, a hosted ATS portal or a LinkedIn page: those
 * describe the portal's vendor, not the employer (the first measurement read "Work with us! We have openings..." as a company).
 */
export function homepageOf(website: string | null | undefined): string | null {
  if (!website) return null
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`)
    if (isKnownBoardHost(url.hostname) || isJobPortalHost(url.hostname) || /(^|\.)linkedin\.com$/i.test(url.hostname)) return null
    return `${url.protocol}//${url.host}/`
  } catch {
    return null
  }
}

const validYear = (y: unknown): y is number => typeof y === 'number' && Number.isInteger(y) && y >= 1800 && y <= new Date().getUTCFullYear()

export function planProfileFill(now: CompanyProfileNow, site: SiteProfile | null, wiki: WikidataProfile | undefined): ProfilePlan {
  const plan: ProfilePlan = {}
  if (!now.foundedYear) {
    if (validYear(site?.foundingYear)) plan.foundedYear = { value: site!.foundingYear!, source: 'site' }
    else if (validYear(wiki?.foundingYear)) plan.foundedYear = { value: wiki!.foundingYear!, source: 'wikidata' }
  }
  if (!now.linkedinUrl && site?.linkedinUrl && /^https:\/\/(?:[a-z]+\.)?linkedin\.com\/company\/[\w%.-]+\/?$/i.test(site.linkedinUrl)) {
    plan.linkedinUrl = { value: site.linkedinUrl, source: 'site' }
  }
  if (!now.description?.trim() && site?.description) plan.taglineForDescription = site.description
  return plan
}

export function buildCompanyDescriptionPrompt(name: string, tagline: string): string {
  return [
    `Restate what the company "${name}" does in one or two plain, factual sentences, using ONLY the text below.`,
    'RULES:',
    '- Use only facts stated in the text. Do not add any number, place, product, customer or claim that is not in it.',
    '- No marketing language ("leading", "best", "world-class", "innovative"), no exclamation marks, no "we", "our" or "you".',
    `- Start with the company name or "${name} is" / "${name} makes" / "${name} provides". Keep it under 260 characters.`,
    '- If the text does not say what the company does, answer {"description": ""}.',
    'Answer with JSON only: {"description": "..."}',
    '',
    'TEXT:',
    tagline,
  ].join('\n')
}

const PROMO = /\b(?:leading|best|world[- ]class|innovative|cutting[- ]edge|revolutionary|#1|number one|award[- ]winning|unmatched)\b/i
const FIRST_PERSON = /\b(?:we|our|ours|us|you|your)\b/i

/** Words with a capital letter or a digit, apart from the first word of the answer: names, products, numbers. */
function claims(text: string): string[] {
  return (text.match(/[A-Za-z0-9][\w.&+-]*/g) ?? []).filter((w, i) => i > 0 && (/[A-Z]/.test(w[0]) || /\d/.test(w)))
}

/** The restated description when it is safe to store, else null (with the reason for the report). */
export function validateCompanyDescription(answer: unknown, name: string, tagline: string): { ok: true; text: string } | { ok: false; reason: string } {
  const text = typeof answer === 'string' ? answer.replace(/\s+/g, ' ').trim() : ''
  if (!text) return { ok: false, reason: 'empty answer' }
  if (text.length < 40 || text.length > 300) return { ok: false, reason: `length ${text.length} outside 40-300` }
  if (/[!]/.test(text) || PROMO.test(text) || FIRST_PERSON.test(text)) return { ok: false, reason: 'marketing or first-person wording' }
  if ((text.match(/[.!?](?:\s|$)/g) ?? []).length > 2) return { ok: false, reason: 'more than two sentences' }
  const source = `${name} ${tagline}`.toLowerCase()
  const invented = claims(text).filter((w) => !source.includes(w.toLowerCase().replace(/[.,;:]+$/, '')))
  if (invented.length) return { ok: false, reason: `not in the tagline: ${invented.slice(0, 4).join(', ')}` }
  return { ok: true, text }
}
