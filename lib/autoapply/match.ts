// lib/autoapply/match.ts
//
// How well a job matches the user's saved résumé, for the swipe deck (owner's request, 2026-11-20: a match score on the
// card, as AIApply shows a fit score). Deliberately simple and explainable, no AI: the share of the job's skills the
// résumé names, whether the résumé names the job's role, and how the job's seniority compares with the most senior title
// on the résumé. The card shows the number with its reasons ("3 of 5 skills on your résumé"), so it is never a black box.
// Pure: no database, no network.

export type MatchInput = {
  title: string
  /** Job.experienceLevel (senior, staff, principal, lead, director, vp, junior, entry, mid). */
  experienceLevel?: string | null
  /** The job's skills, display names or slugs ("design-systems"). */
  skills: string[]
}

export type MatchResult = {
  /** 0-100. */
  score: number
  label: 'Strong match' | 'Good match' | 'Some match' | 'Low match'
  /** The job's skills the résumé names, in the job's order. */
  matched: string[]
  reasons: string[]
}

const RANK: Record<string, number> = { intern: 0, entry: 0, junior: 1, mid: 2, senior: 3, staff: 4, lead: 4, principal: 5, director: 6, vp: 7 }
const LEVEL_WORDS: Array<[RegExp, number]> = [
  [/\b(vp|vice president|chief|cto|cpo|ceo)\b/, 7],
  [/\b(director|head of)\b/, 6],
  [/\bprincipal\b/, 5],
  [/\b(staff|lead)\b/, 4],
  [/\b(senior|sr)\b/, 3],
]
const LEVEL_NAME: Record<number, string> = { 0: 'Entry', 1: 'Junior', 2: 'Mid', 3: 'Senior', 4: 'Staff', 5: 'Principal', 6: 'Director', 7: 'VP' }
// Words in a job title that say nothing about the role itself.
const NOT_ROLE = new Set([
  'senior', 'sr', 'junior', 'jr', 'staff', 'principal', 'lead', 'head', 'of', 'and', 'the', 'a', 'an', 'for', 'to', 'in', 'at',
  'i', 'ii', 'iii', 'iv', 'remote', 'hybrid', 'us', 'usa', 'uk', 'eu', 'with', 'new', 'team', 'level',
])

/**
 * Lower case, punctuation as spaces, keeping the characters skills use (c++, c#, node.js, .net). A full stop only stays
 * when a letter or digit follows it, so "…and prototyping." still names "prototyping".
 */
export function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/\.(?![a-z0-9])/g, ' ').replace(/[^a-z0-9+#.]+/g, ' ').replace(/\s+/g, ' ').trim()} `
}

/** Does the (normalized) résumé name this skill as a whole word? "design-systems" matches "design systems". */
function names(resume: string, skill: string): boolean {
  const s = normalize(skill.replace(/[-_]/g, ' ')).trim()
  if (!s) return false
  const forms = new Set([s, s.replace(/\./g, ''), s.replace(/\./g, ' ').replace(/\s+/g, ' ')])
  return [...forms].some((f) => f && resume.includes(` ${f} `))
}

function jobRank(input: MatchInput): number | null {
  const level = (input.experienceLevel ?? '').toLowerCase()
  // "mid" is also the column's default, so it says little: read the title instead.
  if (level && level !== 'mid' && level in RANK) return RANK[level]
  const t = normalize(input.title)
  for (const [re, rank] of LEVEL_WORDS) if (re.test(t)) return rank
  return null
}

// On a résumé, "lead" is usually the verb ("led", "lead the migration") and "VP" often someone else ("reported to the
// VP"): only titles count, and only near the top, where the latest role usually is.
// Someone else's title ("reported to the VP of Sales", "worked with our director of design") is not the person's.
const NOT_OWN = '(?<!\\b(?:to|the|our|for|with|a) )'
const RESUME_LEVEL_WORDS: Array<[RegExp, number]> = [
  [new RegExp(`${NOT_OWN}\\b(?:vp|vice president) (?:of [a-z]+|engineering|product|marketing|sales|design|people|operations|finance|data|technology)\\b`), 7],
  [new RegExp(`${NOT_OWN}\\b(?:director|head) of [a-z]+`), 6],
  [/\bprincipal [a-z]+/, 5],
  [/\b(staff [a-z]+|(tech|team|engineering|design|product) lead|lead (engineer|developer|designer|product|data|software))/, 4],
  [/\b(senior|sr) [a-z]+/, 3],
]
const RESUME_TOP_CHARS = 1200

/** The most senior title near the top of the résumé, or null. */
function resumeRank(resume: string): number | null {
  const top = resume.slice(0, RESUME_TOP_CHARS)
  for (const [re, rank] of RESUME_LEVEL_WORDS) if (re.test(top)) return rank
  return null
}

/** The display name of a skill: "design-systems" -> "Design systems"; names that already have case are kept. */
export function skillLabel(skill: string): string {
  const s = skill.trim()
  if (/[A-Z]/.test(s)) return s
  const words = s.replace(/[-_]+/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function matchJob(resumeText: string, input: MatchInput): MatchResult {
  const resume = normalize(resumeText)
  const seen = new Set<string>()
  const skills = input.skills.filter((s) => {
    const k = normalize(s.replace(/[-_]/g, ' ')).trim()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 12)
  const matched = skills.filter((s) => names(resume, s))
  const skillShare = skills.length ? matched.length / skills.length : 0

  const roleWords = normalize(input.title).trim().split(' ').filter((w) => w.length > 1 && !NOT_ROLE.has(w))
  const roleShare = roleWords.length ? roleWords.filter((w) => resume.includes(` ${w} `)).length / roleWords.length : 0

  const jr = jobRank(input)
  const rr = resumeRank(resume)
  const gap = jr === null || rr === null ? null : jr - rr
  const levelFit = gap === null ? 0.5 : gap === 0 ? 1 : Math.abs(gap) === 1 ? 0.6 : 0.2

  const raw = skills.length ? 0.55 * skillShare + 0.3 * roleShare + 0.15 * levelFit : 0.65 * roleShare + 0.35 * levelFit
  const score = Math.max(0, Math.min(100, Math.round(raw * 100)))
  const label = score >= 75 ? 'Strong match' : score >= 55 ? 'Good match' : score >= 35 ? 'Some match' : 'Low match'

  const reasons: string[] = []
  if (skills.length) reasons.push(`${matched.length} of ${skills.length} skills on your résumé`)
  if (roleShare >= 0.5) reasons.push('your résumé names this role')
  if (gap === 0 && jr !== null) reasons.push(`${LEVEL_NAME[jr]}-level, like your résumé`)
  else if (gap !== null && gap > 0) reasons.push(gap === 1 ? 'one level above your résumé' : 'well above your résumé’s level')
  else if (gap !== null && gap < 0) reasons.push('below your résumé’s level')
  return { score, label, matched, reasons }
}

/** The job's seniority to show on the card, or null. "mid" is not shown: it is also the column's default. */
export function seniorityLabel(experienceLevel: string | null | undefined, title: string): string | null {
  const level = (experienceLevel ?? '').toLowerCase()
  const rank = level && level !== 'mid' && level in RANK ? RANK[level] : null
  if (rank !== null) return level === 'lead' ? 'Lead' : LEVEL_NAME[rank]
  const t = normalize(title)
  for (const [re, r] of LEVEL_WORDS) if (re.test(t)) return /\blead\b/.test(t) && r === 4 ? 'Lead' : LEVEL_NAME[r]
  return null
}
