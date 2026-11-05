// When a natural-language search ("python developer in germany") is turned into structured filters (role, country,
// seniority…), some words are consumed by those filters and some are not ("python"). The unconsumed words that are
// real words in our jobs should still narrow the results.

import { COUNTRY_KEYWORDS, SENIORITY_KEYWORDS } from '../jobs/nlToFilters'
import { getSynonymsForRole } from '../roles/synonyms'
import { STOPWORDS, correctToken, tokenize, type Vocabulary } from './keywordPlan'

const FILTER_WORDS = new Set([
  ...STOPWORDS,
  'onsite', 'on-site', 'hybrid', 'anywhere', 'global', 'apac', 'emea', 'only', 'worldwide',
  'paying', 'salary', 'per', 'year', 'yr', 'level', 'contract', 'contractor', 'freelance',
  ...Object.values(COUNTRY_KEYWORDS).flat().flatMap((w) => w.split(/\s+/)),
  ...Object.values(SENIORITY_KEYWORDS).flat().flatMap((w) => w.split(/[^a-z0-9]+/)),
])

const wordsOf = (text: string) => text.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean)

/** Query words not accounted for by the matched roles, seniority, country, remote or salary parts of the query. */
export function leftoverTokens(query: string, roleSlugs: string[]): string[] {
  const roleWords = new Set<string>()
  for (const slug of roleSlugs) {
    for (const w of wordsOf(slug.replace(/-/g, ' '))) roleWords.add(w)
    for (const syn of getSynonymsForRole(slug)) for (const w of wordsOf(syn)) roleWords.add(w)
  }
  return tokenize(query).filter(
    (t) => !roleWords.has(t) && !FILTER_WORDS.has(t) && !/^\$?\d+k?\+?$/.test(t),
  )
}

/** Keep only words that exist in our jobs (or are one typo away from one), so a stray word cannot empty the results. */
export function knownLeftover(tokens: string[], vocab: Vocabulary | null): string[] {
  if (!vocab) return []
  return tokens.filter((t) => vocab.counts.has(t) || vocab.terms.some((v) => v.includes(t)) || correctToken(t, vocab) !== null)
}
