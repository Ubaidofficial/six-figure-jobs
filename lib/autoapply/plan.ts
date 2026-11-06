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
  profile: { firstName: string; lastName: string; phone: string; country?: string | null; city?: string | null; linkedin?: string | null; website?: string | null; github?: string | null } | null
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
    out.push({
      key: f.name,
      label: q.label,
      type,
      required: q.required,
      source: std ? std.source : kind ? 'profile' : 'user',
      value: std ? std.value : kind ? clean(inputs.profile?.[kind]) : null,
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

/** Required fields that have no answer yet: the user has to fill these before they can approve. */
export function missingFields(plan: Plan): PlanField[] {
  return plan.fields.filter((f) => f.required && isEmpty(f.value))
}

/** A select answer must be one of the employer's own options; text must be plain text of sane length. Returns an error or null. */
export function checkAnswer(field: PlanField, value: unknown): string | null {
  if (field.type === 'file') return 'not_editable'
  if (field.type === 'single' || field.type === 'multi') {
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
    return { ...f, value: typeof v === 'string' && v.trim() === '' ? null : v }
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
    return kind ? { ...f, value: clean(inputs.profile?.[kind]) } : f
  })
  return { ...plan, fields }
}
