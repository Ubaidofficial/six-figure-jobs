// The life of one application, and the checks that keep it honest. Pure: no database, no browser.

import { createHash } from 'crypto'

import type { Plan } from './plan'

export type AutoApplyStatus = 'draft' | 'approved' | 'submitting' | 'submitted' | 'needs_user' | 'failed' | 'cancelled'

const NEXT: Record<AutoApplyStatus, AutoApplyStatus[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['submitting', 'cancelled'],
  submitting: ['submitted', 'needs_user', 'failed'],
  submitted: [],
  needs_user: [],
  failed: [],
  cancelled: [],
}

export const canMove = (from: AutoApplyStatus, to: AutoApplyStatus) => NEXT[from]?.includes(to) ?? false
export const isFinal = (s: AutoApplyStatus) => (NEXT[s] ?? []).length === 0

/** Statuses that block a second application for the same job (a failed or cancelled one does not). */
export const ACTIVE_STATUSES: AutoApplyStatus[] = ['draft', 'approved', 'submitting', 'submitted']

/** Stable hash of exactly what will be submitted. The user approves this hash; the worker checks it again before it sends anything. */
export function planHash(plan: Plan): string {
  const canonical = JSON.stringify({
    board: plan.board,
    jobId: plan.jobId,
    consent: plan.consentGiven,
    resume: plan.resumeStamp,
    fields: [...plan.fields].sort((a, b) => a.key.localeCompare(b.key)).map((f) => [f.key, f.type, f.value]),
  })
  return createHash('sha256').update(canonical).digest('hex')
}

export type Outcome =
  | { kind: 'submitted'; evidence: string }
  | { kind: 'needs_user'; reason: 'captcha' | 'security_code' | 'login' | 'unexpected_field' | 'validation' | 'unconfirmed' }
  | { kind: 'failed'; reason: string }
  | { kind: 'dry_run'; filled: string[]; unfilled: string[] }
