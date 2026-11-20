// The plan: every answer that will be typed into the employer's form, decided before the user reviews it.
//
// Rule that matters most: we only fill what the user gave us. Name, phone and links come from their profile, the résumé is
// theirs, the cover letter is the one from their kit. Every other question, including all work-authorization, clearance,
// sponsorship and conflict-of-interest questions, is left for the user to answer themselves in the review step. Nothing is
// guessed, and the equal-opportunity (EEOC) questions are never answered.

import type { GhJob, GhQuestion } from './greenhouse'

export type PlanSource = 'profile' | 'account' | 'resume' | 'kit' | 'user'
export type PlanFieldType = 'text' | 'textarea' | 'file' | 'single' | 'multi'

export type PlanField = {
  /** The form control's name at Greenhouse, e.g. first_name or question_123. */
  key: string
  label: string
  type: PlanFieldType
  required: boolean
  source: PlanSource
  /** Text for text fields, the chosen option's value for a single select, a list of values for a multi select, null if empty. */
  value: string | string[] | null
  options?: Array<{ label: string; value: string }>
  /** 'exact': pre-filled from the user's saved answer to the same question (answers.ts). Needs `confirmed` before approval. */
  saved?: 'exact'
  /** The user ticked the pre-filled saved answer on this application. */
  confirmed?: boolean
  /** A saved answer to a similarly worded question, offered to the user; never used unless they choose it. */
  suggestion?: { question: string; text: string; value: string | string[] }
}

export type Plan = {
  board: string
  jobId: string
  title: string
  fields: PlanField[]
  /** The employer asks for consent before applying; the user must tick it in the review. */
  needsConsent: boolean
  consentGiven: boolean
  /** Résumé version (Resume.updatedAt in ms) the application was approved with; the worker refuses a different one. */
  resumeStamp: string
}

export type PlanInputs = {
  email: string
  profile: ({ firstName: string; lastName: string; phone: string; country?: string | null; city?: string | null; linkedin?: string | null; website?: string | null; github?: string | null } & Partial<Record<DetailKind, string | null>>) | null
  resumeStamp: string
  coverLetter: string | null
}

const TYPE: Record<string, PlanFieldType> = {
  input_text: 'text',
  textarea: 'textarea',
  input_file: 'file',
  multi_value_single_select: 'single',
  multi_value_multi_select: 'multi',
}

const clean = (s?: string | null) => (s ?? '').trim() || null

function standardValue(name: string, inputs: PlanInputs): { source: PlanSource; value: string | null } | null {
  const p = inputs.profile
  switch (name) {
    case 'first_name': return { source: 'profile', value: clean(p?.firstName) }
    case 'last_name': return { source: 'profile', value: clean(p?.lastName) }
    case 'phone': return { source: 'profile', value: clean(p?.phone) }
    case 'email': return { source: 'account', value: clean(inputs.email) }
    case 'country': return { source: 'profile', value: clean(p?.country) }
    case 'candidate-location': return { source: 'profile', value: clean(p?.city) }
    case 'resume': return { source: 'resume', value: inputs.resumeStamp }
    case 'resume_text': return null // the PDF of the résumé is attached; the pasted-text twin is not used
    case 'cover_letter': return null // the cover letter goes in as text below
    case 'cover_letter_text': return { source: 'kit', value: clean(inputs.coverLetter) }
    default: return null
  }
}

/** Answers the user keeps in their profile for common questions (ApplyProfile columns). */
export type DetailKind = 'currentCompany' | 'currentTitle' | 'state' | 'postalCode' | 'noticePeriod' | 'salaryExpectation' | 'languages'

const labelKey = (label: string) => label.toLowerCase().replace(/[*?:().]/g, ' ').replace(/\s+/g, ' ').trim()

// Exact wordings (after lower-casing and dropping punctuation) that mean the same question. Kept as whole labels, not
// loose patterns, so "Have you worked at a competitor company?" can never be read as "Current company".
const DETAIL_ALIASES: Record<DetailKind, string[]> = {
  currentCompany: ['current company', 'current employer', 'current company name', 'current employer name', 'most recent company', 'most recent employer', 'present employer'],
  currentTitle: ['current title', 'current job title', 'current role', 'current position', 'most recent title', 'most recent job title'],
  state: ['state', 'province', 'state/province', 'state or province', 'state / province'],
  postalCode: ['zip', 'zip code', 'postal code', 'zip/postal code', 'zip / postal code', 'zip or postal code', 'postcode'],
  noticePeriod: ['notice period', 'what is your notice period', 'when can you start', 'when could you start', 'earliest start date', 'availability to start'],
  salaryExpectation: ['salary expectations', 'salary expectation', 'expected salary', 'desired salary', 'salary requirements', 'compensation expectations', 'desired compensation', 'what are your salary expectations', 'what are your compensation expectations'],
  languages: ['languages', 'languages spoken', 'what languages do you speak', 'which languages do you speak', 'languages you speak'],
}
const DETAIL_BY_LABEL = new Map<string, DetailKind>(
  Object.entries(DETAIL_ALIASES).flatMap(([kind, labels]) => labels.map((l) => [labelKey(l), kind as DetailKind] as const)),
)

/** Which saved detail a free-text question asks for, by its exact (normalised) wording; null for any other question. */
export function detailKind(label: string): DetailKind | null {
  return DETAIL_BY_LABEL.get(labelKey(label)) ?? null
}

/** Which profile link an optional link question asks for, matched by its label; null when it is some other question. */
function linkKind(label: string): 'linkedin' | 'github' | 'website' | null {
  const l = label.toLowerCase()
  if (/linkedin/.test(l)) return 'linkedin'
  if (/github/.test(l)) return 'github'
  if (/(^|\b)(personal )?(website|portfolio)\b/.test(l)) return 'website'
  return null
}

function fieldsOf(q: GhQuestion, inputs: PlanInputs, group: 'standard' | 'custom'): PlanField[] {
  const out: PlanField[] = []
  for (const f of q.fields) {
    const type = TYPE[f.type]
    if (!type) continue // a control type we do not know is caught later by the driver as an unexpected field
    const std = group === 'standard' ? standardValue(f.name, inputs) : null
    if (f.name === 'resume_text' || f.name === 'cover_letter') continue
    const kind = !std && f.type === 'input_text' && !q.required ? linkKind(q.label) : null
    // A common question the user answered in their details fills from there; with no saved answer it is theirs to type.
    const detail = !std && !kind && (f.type === 'input_text' || f.type === 'textarea') ? detailKind(q.label) : null
    const detailValue = detail ? clean(inputs.profile?.[detail]) : null
    out.push({
      key: f.name,
      label: q.label,
      type,
      required: q.required,
      source: std ? std.source : kind || detailValue ? 'profile' : 'user',
      value: std ? std.value : kind ? clean(inputs.profile?.[kind]) : detailValue,
      ...(f.values ? { options: f.values.map((v) => ({ label: v.label, value: String(v.value) })) } : {}),
    })
  }
  return out
}

const STANDARD = new Set(['first_name', 'last_name', 'email', 'phone', 'resume', 'cover_letter'])

export function buildPlan(job: GhJob, ref: { board: string; jobId: string }, inputs: PlanInputs): Plan {
  const fields: PlanField[] = []
  for (const q of job.questions) {
    const isStandard = q.fields.some((f) => STANDARD.has(f.name))
    fields.push(...fieldsOf(q, inputs, isStandard ? 'standard' : 'custom'))
  }
  // The newer Greenhouse form also asks for a country and a city; they are not in the question list, so they are added
  // here, from the profile, to be reviewed and approved like every other answer. A form without them ignores them.
  for (const [key, label] of [['country', 'Country'], ['candidate-location', 'Location (City)']] as const) {
    const std = standardValue(key, inputs)!
    fields.push({ key, label, type: 'text', required: false, source: 'profile', value: std.value })
  }
  return {
    board: ref.board,
    jobId: ref.jobId,
    title: job.title,
    fields,
    needsConsent: job.needsConsent,
    consentGiven: false,
    resumeStamp: inputs.resumeStamp,
  }
}

const isEmpty = (v: PlanField['value']) => v == null || (Array.isArray(v) ? v.length === 0 : v.trim() === '')

/**
 * A phone number in international form: "+", the country code and the number (8 to 15 digits; spaces, dots, dashes and
 * brackets allowed). Without the country code a form's country picker falls back to its default (often +1), so a number
 * without one is never sent.
 */
export function isIntlPhone(v: unknown): boolean {
  if (typeof v !== 'string' || !/^\+[\d\s().-]+$/.test(v.trim())) return false
  const digits = v.replace(/\D/g, '').length
  return digits >= 8 && digits <= 15
}

/** Required fields that have no usable answer yet: the user has to fill these before they can approve. */
export function missingFields(plan: Plan): PlanField[] {
  return plan.fields.filter(
    (f) =>
      (f.required && (isEmpty(f.value) || (f.key === 'phone' && !isIntlPhone(f.value)))) ||
      // A saved answer pre-filled on this application is not approved until the user ticks it, required or not.
      (f.saved === 'exact' && !f.confirmed && !isEmpty(f.value)),
  )
}

/** The user ticked these pre-filled saved answers on this application. */
export function confirmSaved(plan: Plan, keys: unknown): Plan {
  if (!Array.isArray(keys) || !keys.length) return plan
  const set = new Set(keys.filter((k): k is string => typeof k === 'string'))
  return { ...plan, fields: plan.fields.map((f) => (f.saved === 'exact' && set.has(f.key) ? { ...f, confirmed: true } : f)) }
}

/** A select answer must be one of the employer's own options; text must be plain text of sane length. Returns an error or null. */
export function checkAnswer(field: PlanField, value: unknown): string | null {
  if (field.type === 'file') return 'not_editable'
  if (field.type === 'single' || field.type === 'multi') {
    // "Choose…" left as it is: no answer (an optional question stays empty; a required one stays missing).
    if (field.type === 'single' && value === '') return null
    const allowed = new Set((field.options ?? []).map((o) => o.value))
    const list = field.type === 'single' ? [value] : Array.isArray(value) ? value : null
    if (!list || (field.type === 'single' && typeof value !== 'string')) return 'invalid'
    return list.every((v) => typeof v === 'string' && allowed.has(v)) ? null : 'invalid'
  }
  if (typeof value !== 'string') return 'invalid'
  return value.length <= (field.type === 'textarea' ? 5000 : 500) ? null : 'too_long'
}

/** Sets the user's answers. Only fields whose source is the user, or an editable link, can change; others are ignored. */
export function applyAnswers(plan: Plan, answers: Record<string, unknown>): { plan: Plan; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const fields = plan.fields.map((f) => {
    if (!(f.key in answers)) return f
    if (f.source !== 'user') return f // profile, account, résumé and kit values are not edited as answers
    const err = checkAnswer(f, answers[f.key])
    if (err) {
      errors[f.key] = err
      return f
    }
    const v = answers[f.key] as string | string[]
    const value = typeof v === 'string' && v.trim() === '' ? null : v
    // An answer the user typed or picked themselves is theirs: it no longer needs a tick as a saved pre-fill.
    if (JSON.stringify(value) !== JSON.stringify(f.value)) {
      const { saved: _s, confirmed: _c, suggestion: _g, ...rest } = f
      return { ...rest, value }
    }
    return { ...f, value }
  })
  return { plan: { ...plan, fields }, errors }
}

/** Re-reads the profile-sourced values (name, phone, links) after the profile changes; the user's own answers are untouched. */
export function refreshProfileFields(plan: Plan, inputs: PlanInputs): Plan {
  const fields = plan.fields.map((f) => {
    if (f.source === 'account') return { ...f, value: clean(inputs.email) }
    if (f.source !== 'profile') return f
    const std = standardValue(f.key, inputs)
    if (std) return { ...f, value: std.value }
    const kind = linkKind(f.label)
    if (kind) return { ...f, value: clean(inputs.profile?.[kind]) }
    const detail = detailKind(f.label)
    if (!detail) return f
    const value = clean(inputs.profile?.[detail])
    // Cleared in the profile: it becomes the user's to answer on this application again.
    return value ? { ...f, value } : { ...f, source: 'user' as const, value: null }
  })
  return { ...plan, fields }
}

/**
 * The answers the user approved, as text to copy into the employer's form when an application is handed back to them.
 * Choices show the option's wording (not Greenhouse's value id); files and empty answers are left out.
 */
export function approvedAnswers(plan: Plan): Array<{ key: string; label: string; text: string }> {
  const out: Array<{ key: string; label: string; text: string }> = []
  for (const f of plan.fields ?? []) {
    if (f.type === 'file' || f.value == null) continue
    const values = Array.isArray(f.value) ? f.value : [f.value]
    const text = values
      .map((v) => (f.type === 'single' || f.type === 'multi' ? (f.options?.find((o) => o.value === v)?.label ?? v) : v))
      .filter((v) => typeof v === 'string' && v.trim() !== '')
      .join(', ')
    if (text) out.push({ key: f.key, label: f.label, text })
  }
  return out
}
