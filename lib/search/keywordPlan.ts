// Keyword search planning: tokenising, aliases, typo correction and relevance scoring. Pure functions (no database),
// so they can be tested directly; the vocabulary they correct against is loaded by lib/search/vocabulary.ts.

export const STOPWORDS = new Set([
  'the', 'and', 'or', 'for', 'of', 'to', 'in', 'at', 'an', 'with',
  'jobs', 'job', 'remote', 'role', 'roles', 'hiring',
])

/** Words that mean the same thing in job titles. A search for any one also matches the others. */
const ALIAS_GROUPS: string[][] = [
  ['frontend', 'front-end', 'front end'],
  ['backend', 'back-end', 'back end'],
  ['fullstack', 'full-stack', 'full stack'],
  ['swe', 'sde', 'software engineer'],
  ['ml', 'machine learning'],
  ['pm', 'product manager'],
  ['em', 'engineering manager'],
  ['sre', 'site reliability'],
  ['devops', 'dev ops'],
  ['qa', 'quality assurance'],
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['k8s', 'kubernetes'],
  ['node', 'node.js', 'nodejs'],
  ['postgres', 'postgresql'],
  ['gcp', 'google cloud'],
  ['cto', 'chief technology officer'],
  ['vp', 'vice president'],
  ['ux', 'user experience'],
]

const ALIAS_INDEX = new Map<string, string[]>()
for (const group of ALIAS_GROUPS) {
  for (const word of group) ALIAS_INDEX.set(word, group.filter((w) => w !== word))
}

/**
 * What "a word starts with the term" means, in one place so the database filter, the ranking and the typo check agree.
 * A search for "seo" finds "SEO Manager", "Head of SEO", "SEO/AEO Lead" and "(SEO)", and no longer "Warehouse**seo**s"
 * (a match inside a word); "pm" no longer finds "development" but still finds PM, PMO and PMP. Typing the start of a
 * word still works ("engin" finds Engineer), which is why this is a word start, not a whole word.
 */
export const WORD_BOUNDARIES = [' ', '-', '/', '(', ',', '&', ':', '.', '|', '"'] as const

/** The LIKE patterns that mean "a word of the text starts with `term`": the text starts with it, or it follows a boundary. */
export function wordStartPatterns(term: string): Array<{ startsWith: string } | { contains: string }> {
  return [{ startsWith: term }, ...WORD_BOUNDARIES.map((b) => ({ contains: `${b}${term}` }))]
}

/** The same test in JavaScript, with the same boundaries as the patterns above (case-insensitive). */
export function startsAWord(haystack: string, term: string): boolean {
  const h = haystack.toLowerCase()
  const t = term.toLowerCase()
  return h.startsWith(t) || WORD_BOUNDARIES.some((b) => h.includes(`${b}${t}`))
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Is `term` a whole word of `haystack` (not just the start of a longer one)? "PM" is in "Technical PM", not in "PMH". */
export function isWholeWord(haystack: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}($|[^a-z0-9])`, 'i').test(haystack)
}

export function tokenize(keyword: string): string[] {
  const tokens = keyword
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/i)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .slice(0, 6)
  return tokens.length > 0 ? tokens : [keyword.trim().toLowerCase()].filter(Boolean)
}

export type KeywordTerm = {
  /** What the visitor typed. */
  token: string
  /** Strings that satisfy this term: the token itself, its aliases, and a typo correction if one was found. */
  variants: string[]
  corrected?: string
}

export type KeywordPlan = {
  terms: KeywordTerm[]
  corrections: Array<{ from: string; to: string }>
}

export type Vocabulary = {
  /** Distinct lowercase words seen in active jobs, with how many times. */
  counts: Map<string, number>
  /** Same keys as `counts`, as an array for fast scanning. */
  terms: string[]
}

export function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

/**
 * The most plausible vocabulary word for a token that matches nothing, or null.
 * Conservative on purpose: short words and words containing digits are left alone, the first letter must match
 * (typos rarely change it), and 4–5 letter words allow one edit while longer ones allow two.
 */
export function correctToken(token: string, vocab: Vocabulary): string | null {
  if (token.length < 4 || /\d/.test(token)) return null
  if (vocab.counts.has(token) || vocab.terms.some((t) => t.startsWith(token))) return null // already matches something

  const maxDist = token.length <= 5 ? 1 : 2
  let best: { term: string; dist: number; count: number } | null = null
  for (const term of vocab.terms) {
    if (term[0] !== token[0] || Math.abs(term.length - token.length) > maxDist) continue
    const dist = levenshtein(token, term, maxDist)
    if (dist > maxDist) continue
    const count = vocab.counts.get(term) ?? 0
    if (!best || dist < best.dist || (dist === best.dist && count > best.count)) best = { term, dist, count }
  }
  return best?.term ?? null
}

export function buildKeywordPlan(keyword: string, vocab: Vocabulary | null): KeywordPlan {
  const terms: KeywordTerm[] = []
  const corrections: KeywordPlan['corrections'] = []
  for (const token of tokenize(keyword)) {
    const variants = [token, ...(ALIAS_INDEX.get(token) ?? [])]
    const term: KeywordTerm = { token, variants }
    if (vocab) {
      const fixed = correctToken(token, vocab)
      if (fixed) {
        term.corrected = fixed
        variants.push(fixed)
        corrections.push({ from: token, to: fixed })
      }
    }
    terms.push(term)
  }
  return { terms, corrections }
}

type Scorable = {
  title?: string | null
  company?: string | null
  locationRaw?: string | null
  techStack?: string | null
  skillsJson?: string | null
}

/**
 * Relevance of one job to a plan: a match in the title counts most, then company, then skills, then location.
 * In the title a whole word ("PM") beats a longer word that starts with it ("PMH"). Exact words beat aliases beat typo
 * corrections; matching every term in the title earns a bonus.
 */
export function scoreJob(plan: KeywordPlan, job: Scorable): number {
  const title = (job.title ?? '').toLowerCase()
  const company = (job.company ?? '').toLowerCase()
  const skills = `${job.skillsJson ?? ''} ${job.techStack ?? ''}`.toLowerCase()
  const location = (job.locationRaw ?? '').toLowerCase()

  let total = 0
  let titleHits = 0
  for (const term of plan.terms) {
    let best = 0
    term.variants.forEach((variant, i) => {
      // An abbreviation's full phrase is what the visitor means ("pm" = "product manager"), so it ranks level with the
      // abbreviation itself; for a full word an alias ("frontend" = "front-end") is a notch below the exact word.
      const weight = i === 0 ? 1 : variant === term.corrected ? 0.7 : term.token.length <= 3 ? 1 : 0.9
      let s = 0
      if (isWholeWord(title, variant)) s = 10
      else if (startsAWord(title, variant)) s = 8
      else if (startsAWord(company, variant)) s = 5
      else if (startsAWord(skills, variant)) s = 3
      else if (startsAWord(location, variant)) s = 1
      if (s * weight > best) best = s * weight
    })
    total += best
    if (term.variants.some((v) => startsAWord(title, v))) titleHits++
  }
  if (plan.terms.length > 1 && titleHits === plan.terms.length) total += 5
  return total
}
