// lib/autoapply/answers.ts
// The user's saved answers: what they answered to an employer's question before, offered again when the same question
// comes up on a later application. Pure (no database). The rules, chosen so a saved answer can never be sent unseen:
//  - an answer is used only for the SAME question (same wording once lower-cased and stripped of punctuation) and the
//    same kind of control, and for a choice only when the employer offers an option with exactly the saved wording;
//  - even then it is pre-filled, not approved: the user must tick it on that application before it can be approved;
//  - a question that is only worded similarly gets a suggestion the user can click, never a pre-fill. "Do you NOT need…"
//    never matches "Do you need…", and when two saved answers are about equally close, neither is suggested;
//  - questions about demographics (gender, race, veteran or disability status…) are never saved.
// Design adapted from the answer matching in neonwatty/job-apply-plugin (MIT); no code copied.

import type { Plan, PlanField } from './plan'

export type SavedAnswerRow = { question: string; questionKey: string; type: string; answer: unknown }
export type Suggestion = { question: string; text: string; value: string | string[] }

const PUNCT = /[‘’'"*?!:;,.()[\]{}]/g

/** Lower case, no punctuation, single spaces: two wordings of the same question compare equal. */
export function questionKey(label: string): string {
  return label.toLowerCase().replace(PUNCT, ' ').replace(/\s+/g, ' ').trim()
}

const NEGATION = /\b(not|no|never|without|none|neither|nor|don t|do not|does not|doesn t|isn t|aren t|won t|cannot|can t)\b/
export const hasNegation = (key: string) => NEGATION.test(key.replace(/'/g, ' '))

const DEMOGRAPHIC = /\b(gender|sex|sexual orientation|race|racial|ethnic|ethnicity|hispanic|latino|veteran|disabilit|pronoun|transgender|religio)/
/** Questions whose answers are never kept (equal-opportunity and similar). */
export const isDemographic = (label: string) => DEMOGRAPHIC.test(label.toLowerCase())

const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'for', 'you', 'your', 'are', 'do', 'is', 'will', 'be', 'this', 'with', 'or', 'and', 'at', 'on', 'we'])
const tokens = (key: string) => new Set(key.split(' ').filter((t) => t.length > 1 && !STOP.has(t)))
function overlap(a: string, b: string): number {
  const x = tokens(a)
  const y = tokens(b)
  if (!x.size || !y.size) return 0
  let common = 0
  for (const t of x) if (y.has(t)) common++
  return common / (x.size + y.size - common)
}

const answerText = (answer: unknown): string | null => (typeof answer === 'string' && answer.trim() ? answer : null)
const answerLabels = (answer: unknown): string[] | null =>
  Array.isArray(answer) && answer.length && answer.every((a) => typeof a === 'string') ? (answer as string[]) : null

/** The saved answer as a value for this field, or null when it does not fit (an option wording the employer lacks). */
export function valueFor(field: PlanField, answer: unknown): string | string[] | null {
  if (field.type === 'text' || field.type === 'textarea') {
    const t = answerText(answer)
    return t && t.length <= (field.type === 'textarea' ? 5000 : 500) ? t : null
  }
  const labels = answerLabels(answer)
  if (!labels) return null
  const byLabel = new Map((field.options ?? []).map((o) => [o.label.trim().toLowerCase(), o.value]))
  const values = labels.map((l) => byLabel.get(l.trim().toLowerCase()))
  if (values.some((v) => v === undefined)) return null
  if (field.type === 'single') return values.length === 1 ? values[0]! : null
  return field.type === 'multi' ? (values as string[]) : null
}

/** What to keep from an answered field: its wording, kind and answer (choices as option labels). Null if nothing to keep. */
export function toSaved(field: PlanField): SavedAnswerRow | null {
  if (field.source !== 'user' || field.type === 'file' || isDemographic(field.label)) return null
  if (field.saved === 'exact' && !field.confirmed) return null // a pre-fill the user has not accepted is not their answer
  const v = field.value
  if (v == null || (Array.isArray(v) ? v.length === 0 : v.trim() === '')) return null
  const key = questionKey(field.label)
  if (!key) return null
  if (field.type === 'single' || field.type === 'multi') {
    const list = Array.isArray(v) ? v : [v]
    const labels = list.map((x) => field.options?.find((o) => o.value === x)?.label).filter((l): l is string => Boolean(l))
    if (labels.length !== list.length) return null
    return { question: field.label, questionKey: key, type: field.type, answer: labels }
  }
  return { question: field.label, questionKey: key, type: field.type, answer: String(v) }
}

const SUGGEST_AT = 0.6
const TIE = 0.05

/**
 * What the saved answers offer for one empty question: an exact pre-fill, a suggestion, or nothing. Only for questions
 * the user answers themselves; demographics are never matched.
 */
export function matchSaved(field: PlanField, saved: SavedAnswerRow[]): { exact: string | string[] } | { suggest: Suggestion } | null {
  if (field.source !== 'user' || field.type === 'file' || isDemographic(field.label)) return null
  const key = questionKey(field.label)
  const sameType = saved.filter((s) => s.type === field.type)
  const exact = sameType.find((s) => s.questionKey === key)
  if (exact) {
    const v = valueFor(field, exact.answer)
    return v == null ? null : { exact: v }
  }
  const neg = hasNegation(key)
  const scored = sameType
    .filter((s) => hasNegation(s.questionKey) === neg)
    .map((s) => ({ s, score: overlap(key, s.questionKey), value: valueFor(field, s.answer) }))
    .filter((x) => x.value != null && x.score >= SUGGEST_AT)
    .sort((a, b) => b.score - a.score)
  if (!scored.length) return null
  const [top, next] = scored
  if (next && top.score - next.score < TIE && JSON.stringify(next.value) !== JSON.stringify(top.value)) return null
  const text = Array.isArray(top.s.answer) ? (top.s.answer as string[]).join(', ') : String(top.s.answer)
  return { suggest: { question: top.s.question, text, value: top.value! } }
}

/** Fills a new plan from the saved answers: exact matches pre-filled (unconfirmed), similar ones as suggestions. */
export function prefillFromSaved(plan: Plan, saved: SavedAnswerRow[]): Plan {
  if (!saved.length) return plan
  const fields = plan.fields.map((f) => {
    if (f.source !== 'user' || (f.value != null && !(typeof f.value === 'string' && f.value.trim() === ''))) return f
    const m = matchSaved(f, saved)
    if (!m) return f
    if ('exact' in m) return { ...f, value: m.exact, saved: 'exact' as const, confirmed: false }
    return { ...f, suggestion: m.suggest }
  })
  return { ...plan, fields }
}
