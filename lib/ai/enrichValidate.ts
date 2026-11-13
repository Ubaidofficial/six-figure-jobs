// lib/ai/enrichValidate.ts
//
// A check that an LLM rewrite of a job description did not invent anything. Free models are small and do make things up
// ("10+ years" for "5+ years", a salary, a tech stack), and a rewrite that misstates a posting is worse than none. So every
// number, tech name and benefit claim in the output must be findable in the source text, and the sections a posting has
// must not come back empty. Lenient on purpose (a tech name counts if its first word appears anywhere in the source): the aim is
// to catch invented facts, not to grade the writing. Numbers match as whole numbers ("10" is not found inside "10,000"), and a
// number the posting spells out in words ("five years") is flagged, which errs toward a human look. Pure.
import type { AiEnrichOutput } from './aiEnrichPrompt'

export type Validation = { ok: boolean; problems: string[] }

const norm = (s: string) => s.toLowerCase().replace(/,/g, '')

/** Numbers in a text that carry a claim: two or more digits, or any digit with a unit (years, %, k, m, +). */
export function claimedNumbers(text: string): Array<{ digits: string; suffix: string }> {
  const out: Array<{ digits: string; suffix: string }> = []
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)(\s?(?:k\b|m\b|%|\+|years?\b|yrs?\b))?/gi)) {
    const digits = m[1].replace(/,/g, '')
    const suffix = (m[2] ?? '').trim().toLowerCase()
    if (digits.replace('.', '').length >= 2 || suffix) out.push({ digits, suffix })
  }
  return out
}

/** Whole numbers only: the "10" in "10+ years" must not be found inside "10,000 customers". */
function numbersIn(text: string): Set<string> {
  return new Set(text.match(/\d+(?:\.\d+)?/g) ?? [])
}

function numberIsInSource(n: { digits: string; suffix: string }, sourceNumbers: Set<string>): boolean {
  if (sourceNumbers.has(n.digits)) return true
  if (n.suffix === 'k' && sourceNumbers.has(`${n.digits}000`)) return true // "150k" for "150,000"
  if (n.suffix === 'm' && sourceNumbers.has(`${n.digits}000000`)) return true
  return false
}

const RESPONSIBILITIES = /responsibilit|you will|you'll|what you'll do|day[- ]to[- ]day/i
const QUALIFICATIONS = /requirement|qualification|you have|must have|years of experience|experience (?:with|in)/i
const BENEFITS = /benefit|perk|401|insurance|pto|paid time|equity|stock|bonus|stipend|vacation|health|dental|parental|retirement/i

export function validateEnrichment(out: AiEnrichOutput, sourceText: string): Validation {
  const problems: string[] = []
  const sourceNumbers = numbersIn(norm(sourceText))
  const sourceRaw = sourceText.toLowerCase()

  if (out.oneLiner.trim().length < 20) problems.push('one-liner is too short')
  if (out.snippet.trim().length < 40) problems.push('snippet is too short')

  if (RESPONSIBILITIES.test(sourceText) && out.description.length < 2) problems.push('no responsibilities, but the posting lists them')
  if (QUALIFICATIONS.test(sourceText) && out.requirements.length < 2) problems.push('no requirements, but the posting lists them')
  if (out.benefits.length > 0 && !BENEFITS.test(sourceText)) problems.push('benefits listed, but the posting mentions none')

  const everything = [out.oneLiner, out.snippet, ...out.description, ...out.requirements, ...out.benefits, ...(out.bullets ?? [])].join(' \n ')
  const seen = new Set<string>()
  for (const n of claimedNumbers(norm(everything))) {
    const key = `${n.digits}${n.suffix}`
    if (seen.has(key)) continue
    seen.add(key)
    if (!numberIsInSource(n, sourceNumbers)) problems.push(`number not in the posting: ${n.digits}${n.suffix}`)
  }

  for (const tech of out.techStack ?? []) {
    const head = tech.toLowerCase().split(/[\s./-]+/)[0]
    if (head.length >= 2 && !sourceRaw.includes(head)) problems.push(`tech not in the posting: ${tech}`)
  }

  return { ok: problems.length === 0, problems }
}
