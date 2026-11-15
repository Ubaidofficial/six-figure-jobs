// lib/jobs/remoteScope.ts
//
// WHO a remote job is open to, read from the posting's own sentences with the sentence as evidence: anywhere in the world,
// or limited to one or more countries or a region. The location field often says only "Remote"; the description says
// "Must be authorized to work in the United States" or "We hire anywhere in the world". Precision first, because this
// can end up in JobPosting `applicantLocationRequirements` (a remote job offered to the wrong countries is worse than an
// undecided one): it answers only when the posting says one thing, never overrides a stored value, and hands back the
// verbatim sentence (checked with verifyQuote). Owner asked for it on 2026-11-15.
//
// Rules, in order:
//  - a sentence that LIMITS ("must reside in", "authorized to work in", "US only", "US-based", "open to candidates in X",
//    "remote within the UK", "EU time zones") gives a country list or a region;
//  - a sentence that OPENS ("work from anywhere in the world", "hire worldwide", "global remote") gives worldwide, but only
//    when NO sentence anywhere in the posting limits it (the site's own rule for location text: leaving a worldwide job
//    out is better than offering a US-only one to the world);
//  - two limiting sentences that name different places, or an opening and a limiting sentence together: no answer.
//
// Pure: no database, no network.
import { countriesFromText } from '../location/jobLocation'
import { plainPostingText, splitSentences, verifyQuote } from './verifiedQuote'

export type RemoteScope =
  | { kind: 'worldwide'; quote: string }
  | { kind: 'countries'; countries: string[]; quote: string }
  | { kind: 'region'; region: 'europe' | 'emea' | 'apac' | 'latam' | 'north-america'; quote: string }

// "must be located in the United States", "must reside in Canada or the US", "has to be based in the UK".
const MUST_BE_IN = /\b(?:must|need(?:s)? to|have to|has to|required to|should)\s+(?:be\s+)?(?:currently\s+)?(?:located|based|living|residing|reside|live|resident|work)\s+(?:and\s+(?:work|live)\s+)?(?:in|within|from)\s+(?:the\s+)?([^.;:()]{2,80})/i
// "authorized to work in the United States", "eligible to work in the UK", "right to work in Ireland".
const AUTHORIZED_IN = /\b(?:authori[sz]ed|eligible|legally entitled|permitted|right)\s+to\s+work\s+(?:legally\s+)?in\s+(?:the\s+)?([^.;:()]{2,60})/i
// "US-based", "UK based remote", "Canada-based".
const BASED_ADJ = /\b(US|U\.S\.|USA|UK|U\.K\.|Canada|Canadian|Australia|Australian|Ireland|Germany|France|Netherlands|Spain|Poland)[-\s]based\b/i
// "US only", "Canada only", "(US residents only)".
const ONLY = /\b(US|U\.S\.|USA|United States|UK|United Kingdom|Canada|Australia|Ireland|Germany)\s+(?:residents?\s+|citizens?\s+|candidates\s+|applicants\s+)?only\b/i
// "open to candidates in the US and Canada", "hiring in the UK", "remote within the United States", "remote (US)".
const OPEN_TO_IN = /\b(?:open\s+to|hiring\s+(?:candidates\s+)?(?:in|from)|accepting\s+applications\s+from|remote\s+(?:position\s+)?(?:in|within|across|from)|anywhere\s+(?:in|within|across)|work\s+remotely\s+(?:from|within|in))\s+(?:candidates\s+|applicants\s+)?(?:located\s+)?(?:in\s+|within\s+)?(?:the\s+)?([^.;:()]{2,60})/i
const REGION_IN = /\b(?:in|within|across|from)\s+(?:the\s+)?(Europe|European Union|EU|EMEA|APAC|Asia[- ]Pacific|LATAM|Latin America|North America)\b/i
const TIMEZONE = /\b(?:EU|European|CET|EMEA|UK|GMT)\s+(?:time\s*)?zones?\b/i

// "work from anywhere in the world", "hire worldwide", "open to candidates globally", "global remote", "anywhere in the world".
const OPENS = /\b(?:anywhere\s+in\s+the\s+world|from\s+anywhere\s+in\s+the\s+world|work(?:ing)?\s+from\s+anywhere|worldwide|world-wide|globally\s+(?:distributed|remote)|global\s+remote|remote[- ]first[^.]{0,40}\banywhere\b|hir(?:e|ing)\s+(?:globally|worldwide|anywhere)|any\s+country|across\s+the\s+globe|around\s+the\s+(?:world|globe))\b/i
// An opening phrase that is itself limited: "anywhere in the US", "worldwide customers" is not about the candidate.
const OPENS_BUT_LIMITED = /\b(?:anywhere|worldwide|globally)\s+(?:in|within|across)\s+(?:the\s+)?(?:US|U\.S\.|USA|United States|UK|Europe|EU|Canada|Australia|[A-Z]{2}\b)/i
const ABOUT_SOMETHING_ELSE = /\b(?:customers?|clients?|users?|offices?|teams?\s+(?:are|is)\s+located|employees\s+worldwide|(?:millions?|thousands?)\s+of|brands?|markets?|presence|leading|largest|operat(?:e|es|ing)\s+(?:in|across))\b[^.]{0,80}\b(?:worldwide|around the world|across the globe|globally)\b|\b(?:worldwide|around the world|globally)\b[^.]{0,40}\b(?:customers?|clients?|users?|brands?)\b/i

const REGION_BY_WORD: Record<string, RemoteScope extends infer T ? (T extends { region: infer R } ? R : never) : never> = {
  europe: 'europe',
  'european union': 'europe',
  eu: 'europe',
  emea: 'emea',
  apac: 'apac',
  'asia-pacific': 'apac',
  'asia pacific': 'apac',
  latam: 'latam',
  'latin america': 'latam',
  'north america': 'north-america',
}

// The clause ends where the sentence moves on ("... the United States to be considered", "... Canada and are ...").
const limitingCountries = (clause: string): string[] =>
  countriesFromText(clause.split(/\s+(?:to|for|in order|so that|as|and\s+(?:be|have|are|will|must|you))\b/i)[0].replace(/\b(?:residents?|citizens?|candidates|applicants)\b/gi, ' '))

type Limit = { countries?: string[]; region?: string; sentence: string }

function limitOf(sentence: string): Limit | null {
  for (const re of [MUST_BE_IN, AUTHORIZED_IN, OPEN_TO_IN]) {
    const m = re.exec(sentence)
    if (m) {
      const countries = limitingCountries(m[1])
      if (countries.length) return { countries, sentence }
      const region = REGION_BY_WORD[m[1].trim().toLowerCase().replace(/^the\s+/, '')]
      if (region) return { region, sentence }
    }
  }
  const adj = BASED_ADJ.exec(sentence)
  if (adj) {
    const countries = limitingCountries(adj[1].replace(/^Canadian$/i, 'Canada').replace(/^Australian$/i, 'Australia'))
    if (countries.length) return { countries, sentence }
  }
  const only = ONLY.exec(sentence)
  if (only) {
    const countries = limitingCountries(only[1])
    if (countries.length) return { countries, sentence }
  }
  const region = REGION_IN.exec(sentence)
  if (region && /\b(?:remote\w*|candidates|applicants|hiring|located|based|time zone)\b/i.test(sentence)) {
    const r = REGION_BY_WORD[region[1].toLowerCase()]
    if (r) return { region: r, sentence }
  }
  if (TIMEZONE.test(sentence) && /\b(?:remote\w*|work\w*|hours|overlap|located)\b/i.test(sentence)) {
    return { region: /\b(?:EU|European|CET)\b/i.test(sentence) ? 'europe' : 'emea', sentence }
  }
  return null
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((c) => b.includes(c))

/** Who this remote job is open to, from the posting's own sentences; null when it does not say one clear thing. */
export function readRemoteScope(html: string | null | undefined): RemoteScope | null {
  const text = plainPostingText(html)
  if (!text) return null
  const sentences = splitSentences(text)

  const limits: Limit[] = []
  const opens: string[] = []
  for (const sentence of sentences) {
    const limit = limitOf(sentence)
    if (limit) limits.push(limit)
    if (OPENS.test(sentence) && !OPENS_BUT_LIMITED.test(sentence) && !ABOUT_SOMETHING_ELSE.test(sentence)) opens.push(sentence)
  }

  if (limits.length > 0) {
    // An opening sentence beside a limiting one contradicts: no answer. Several limits must name the same place.
    if (opens.length > 0) return null
    const first = limits[0]
    for (const l of limits) {
      if (first.countries && l.countries && !sameSet(first.countries, l.countries)) return null
      if (Boolean(first.countries) !== Boolean(l.countries)) return null
      if (first.region && l.region && first.region !== l.region) return null
    }
    const quote = first.sentence
    if (!verifyQuote(quote, text)) return null
    if (first.countries) return { kind: 'countries', countries: first.countries, quote }
    return { kind: 'region', region: first.region as 'europe', quote }
  }

  if (opens.length > 0) {
    const quote = opens[0]
    if (!verifyQuote(quote, text)) return null
    return { kind: 'worldwide', quote }
  }
  return null
}
