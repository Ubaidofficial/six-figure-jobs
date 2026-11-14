// lib/jobs/experienceRequirement.ts
//
// How many years of experience a posting asks for ("5+ years", "3-5 years of experience"), with the sentence it was read
// from, so a page can show "5+ yrs experience" the way other boards do and a person can check it. Free and deterministic.
//
// Conservative on purpose: the sentence must talk about experience (so "founded 10 years ago" and "for over 20 years we
// have..." do not count), must not be a preference ("nice to have", "preferred", "plus"), and the largest stated minimum
// wins (a posting that asks for "8+ years in the industry, 3+ years leading teams" asks for 8). Pure.
import { plainPostingText, splitSentences } from './verifiedQuote'

export type ExperienceRequirement = {
  minYears: number
  /** The top of a range ("3-5 years"), else null. */
  maxYears: number | null
  /** "5+" style: the minimum with nothing said about a top. */
  openEnded: boolean
  sentence: string
}

const YEARS = /\b(\d{1,2})(?:\s*(?:-|–|—|to)\s*(\d{1,2}))?\s*(\+)?\s*(?:years?|yrs?)\b/gi
const ABOUT_EXPERIENCE = /\b(?:experience|experienced|expertise|background|track record|hands-on|professional)\b/i
const NOT_A_REQUIREMENT = /\b(?:nice[- ]to[- ]have|preferred|preferably|bonus|a plus|\bplus\b|ideally|desirable|advantage|years ago|founded|since \d{4}|for over \d+ years|for more than \d+ years|we have (?:been|helped|over))\b/i
// "up to 2 years" and "less than 3 years" are ceilings (entry-level roles), not minimums.
const CEILING = /\b(?:up to|less than|fewer than|no more than|under|maximum(?: of)?)\s+\d/i
const MAX_PLAUSIBLE_YEARS = 25

/** The strongest experience requirement in the posting, or null when it states none. */
export function findExperienceRequirement(descriptionHtml: string | null | undefined): ExperienceRequirement | null {
  let best: ExperienceRequirement | null = null
  for (const sentence of splitSentences(plainPostingText(descriptionHtml))) {
    if (!ABOUT_EXPERIENCE.test(sentence) || NOT_A_REQUIREMENT.test(sentence) || CEILING.test(sentence)) continue
    for (const m of sentence.matchAll(YEARS)) {
      const min = Number(m[1])
      const max = m[2] ? Number(m[2]) : null
      if (!min || min > MAX_PLAUSIBLE_YEARS || (max !== null && (max < min || max > MAX_PLAUSIBLE_YEARS))) continue
      if (!best || min > best.minYears) best = { minYears: min, maxYears: max, openEnded: max === null && Boolean(m[3]), sentence }
    }
  }
  return best
}

/** "5+ yrs experience", "3-5 yrs experience", "5 yrs experience". */
export function experienceLabel(req: ExperienceRequirement): string {
  const years = req.maxYears ? `${req.minYears}-${req.maxYears}` : req.openEnded ? `${req.minYears}+` : String(req.minYears)
  return `${years} yrs experience`
}
