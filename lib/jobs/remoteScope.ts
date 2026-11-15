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

// Only statements about WHERE THE CANDIDATE may work count: "open to candidates anywhere in the world", "we hire worldwide",
// "work remotely from any country", "Location: Worldwide". The words "worldwide", "around the world", "across the globe",
// "globally" and "from anywhere" alone are company marketing ("customers worldwide", "employees around the globe", "our
// mission worldwide", "do your best work from anywhere"): in the first audit of 5,784 live remote jobs they gave about 650 wrong
// readings in 800 conflicts, so they are not read.
const OPENS = new RegExp(
  [
    '(?:candidates|applicants)\\s+(?:from\\s+|located\\s+|based\\s+)?(?:anywhere(?!\\s+(?:in|within|across)\\s+(?:the\\s+)?(?!world\\b|globe\\b))|worldwide|globally|around\\s+the\\s+(?:world|globe)|across\\s+the\\s+globe)',
    'open\\s+to\\s+(?:candidates\\s+|applicants\\s+)?(?:anywhere(?!\\s+(?:in|within|across)\\s+(?:the\\s+)?(?!world\\b|globe\\b))|worldwide|globally)',
    'anywhere\\s+in\\s+the\\s+world',
    'hir(?:e|es|ing)\\s+(?:globally|worldwide|anywhere|(?:remotely\\s+)?(?:from|in)\\s+any\\s+country)',
    'work(?:ing)?\\s+(?:remotely\\s+)?from\\s+any\\s+country',
    'location\\s*[:\\-–]\\s*(?:worldwide|anywhere|global)',
    'remote\\s*[-–:]\\s*(?:worldwide|anywhere\\s+in\\s+the\\s+world)',
  ].join('|'),
  'i',
)
// ...and the sentence must talk about the person or the role, not a perk or the company.
const ABOUT_THE_CANDIDATE = /\b(?:candidates?|applicants?|you|your|role|position|job|hir(?:e|es|ing)|work(?:ing)?|location)\b/i
const NOT_A_STATEMENT_ABOUT_WORK = /\b(?:perk|stipend|travel|bonus|trip|vacation|flights?|customers?|clients?|users?|offices?|brands?)\b/i

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

// The clause ends where the sentence moves on ("... the United States to be considered", "... Canada and are ..."); a
// leading "residing in the" is dropped; and EVERY listed place must be a country we know. One we do not ("Latin America",
// "other listed locations") means the sentence says more than we can list, so the answer is none, never a partial list
// ("the US and Canada" read as Canada only, "the United States or Latin America" read as the US only: first audit).
const limitingCountries = (clause: string): string[] => {
  const cut = clause.split(/\s+(?:to|for|in order|so that|as|and\s+(?:be|have|are|will|must|you))\b/i)[0]
  const stripped = cut
    .replace(/\b(?:residents?|citizens?|candidates|applicants)\b/gi, ' ')
    .replace(/\bonly\b/gi, ' ')
    .replace(/^\s*(?:currently\s+)?(?:residing|living|located|based|working)?\s*(?:anywhere\s+)?(?:in|within|from|across)?\s*(?:the\s+)?/i, '')
  const parts = stripped.split(/\s*(?:,|;|&|\/|\band\b|\bor\b|\beither\b|\bboth\b)\s*/i).map((p) => p.replace(/^the\s+/i, '').trim()).filter(Boolean)
  const codes: string[] = []
  for (const part of parts) {
    // "CA", "DE", "IE" alone could be California, a word or a country: only "US" and "UK" are read as codes.
    if (/^[A-Za-z]{2}$/.test(part) && !/^(?:US|UK)$/i.test(part)) return []
    const found = countriesFromText(part)
    if (found.length === 0) return []
    codes.push(...found)
  }
  return Array.from(new Set(codes))
}

// A sentence that names a place but is about something else: benefits and pay ("benefits for US-based employees", "the salary
// range is for residents of the US only"), colleagues and teams ("our Australia-based team", "a US-based CRO"), a legal
// notice ("San Francisco Fair Chance Ordinance"), or a list that is only preferred ("United States preferred; open to ...").
const NOT_ABOUT_WHO_MAY_APPLY =
  /\b(?:benefits?|compensation|salary|salaries|pay|paid|bonus|perks?|401\(?k\)?|insurance|medical|dental|vision|ordinance|equal opportunity|EEO|fair chance|privacy|customers?|clients?|preferred)\b/i
// An implicit statement ("US-based", "open to candidates in", "remote in") must also talk about the role or the person.
const ABOUT_THE_ROLE = /\b(?:position|role|job|opening|candidates?|applicants?|employment|remote\w*|hir(?:e|es|ing)|apply|located|reside\w*|work(?:ing)?)\b/i

const COUNTRY_TOKEN = /\b(?:US|USA|U\.S\.|United States|Canada|UK|U\.K\.|United Kingdom|Australia|Ireland|Germany|France|Spain|Netherlands|Poland)\b/
const MONEY_IN_SENTENCE = /[$£€]\s?\d|\b(?:USD|CAD|AUD|GBP|EUR|CHF)\b/

type Limit = { countries?: string[]; region?: string; sentence: string }

function limitOf(sentence: string): Limit | null {
  // A sentence about pay by location ("$148,000 for most US-based locations, $131,000 CAD in Canada...") limits nothing.
  if (MONEY_IN_SENTENCE.test(sentence) || NOT_ABOUT_WHO_MAY_APPLY.test(sentence)) return null
  for (const re of [MUST_BE_IN, AUTHORIZED_IN, OPEN_TO_IN]) {
    const m = re.exec(sentence)
    if (m) {
      if (re === OPEN_TO_IN && !ABOUT_THE_ROLE.test(sentence)) continue
      const countries = limitingCountries(m[1])
      if (countries.length) return { countries, sentence }
      const region = REGION_BY_WORD[m[1].trim().toLowerCase().replace(/^the\s+/, '')]
      if (region) return { region, sentence }
    }
  }
  if (!ABOUT_THE_ROLE.test(sentence)) return null
  const adj = BASED_ADJ.exec(sentence)
  // "US-based" about a colleague, a team or the staff ("working with a US-based CRO", "our Australia-based team", "benefits for
  // Canada-based employees") says nothing about where THIS person must be.
  const aboutOthers =
    adj &&
    (/\b(?:with|alongside)\s+(?:our\s+|the\s+|a\s+|an\s+)?$/i.test(sentence.slice(Math.max(0, adj.index - 24), adj.index)) ||
      /^\s*(?:teams?|employees?|colleagues?|counterparts?|orgs?|organi[sz]ations?|offices?|staff|customers?|clients?|CRO|team members?)\b/i.test(sentence.slice(adj.index + adj[0].length)))
  if (adj && !aboutOthers) {
    const countries = limitingCountries(adj[1].replace(/^Canadian$/i, 'Canada').replace(/^Australian$/i, 'Australia'))
    if (countries.length) return { countries, sentence }
  }
  const only = ONLY.exec(sentence)
  if (only) {
    const countries = limitingCountries(only[1])
    if (countries.length) return { countries, sentence }
  }
  const region = REGION_IN.exec(sentence)
  if (region && !COUNTRY_TOKEN.test(sentence) && /\b(?:remote\w*|candidates|applicants|hiring|located|based|time zone)\b/i.test(sentence)) {
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
    if (OPENS.test(sentence) && ABOUT_THE_CANDIDATE.test(sentence) && !NOT_A_STATEMENT_ABOUT_WORK.test(sentence)) opens.push(sentence)
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
