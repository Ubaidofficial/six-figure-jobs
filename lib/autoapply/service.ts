// Prepare, review, approve and run one hosted application. The rules this file keeps:
//   - Nothing is submitted that the user did not approve: the worker checks the approved plan hash and résumé version again.
//   - A credit is taken only for a submission the employer confirmed. A captcha, a security code, a login wall, a field we
//     do not know, a validation error or any failure charges nothing and leaves the user the employer's own link.
//   - One live application per job, and caps per user per day and per employer per hour.

import { MAX_APPLICATIONS_PER_USER_PER_DAY, MAX_PER_BOARD_PER_HOUR, getAutoApplyCredits } from './config'
import { fetchGreenhouseJob, parseGreenhouseUrl, type GhJob } from './greenhouse'
import {
  applyAnswers,
  buildPlan,
  missingFields,
  refreshProfileFields,
  type Plan,
  type PlanInputs,
} from './plan'
import { ACTIVE_STATUSES, planHash, type Outcome } from './state'

import { findKitJob, type KitJob } from '@/lib/applykit/job'
import { getBalance, spendCredits } from '@/lib/billing/credits'
import { prisma } from '@/lib/prisma'

export type ApplyErrorCode =
  | 'no_resume' | 'job_not_found' | 'unsupported_employer' | 'form_unavailable' | 'already_exists'
  | 'not_found' | 'not_editable' | 'invalid' | 'incomplete' | 'consent_required' | 'changed'
  | 'insufficient_credits' | 'daily_limit'

const STATUS: Record<ApplyErrorCode, number> = {
  no_resume: 400, invalid: 400, job_not_found: 404, not_found: 404, unsupported_employer: 422, incomplete: 422,
  consent_required: 422, form_unavailable: 502, already_exists: 409, not_editable: 409, changed: 409,
  insufficient_credits: 402, daily_limit: 429,
}

export class AutoApplyError extends Error {
  readonly status: number
  constructor(readonly code: ApplyErrorCode, readonly details?: unknown) {
    super(code)
    this.name = 'AutoApplyError'
    this.status = STATUS[code]
  }
}

export type ProfileInput = {
  firstName?: unknown; lastName?: unknown; phone?: unknown
  country?: unknown; city?: unknown; linkedin?: unknown; website?: unknown; github?: unknown
}

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim().length <= max ? v.trim() : null)
const url = (v: unknown) => {
  if (v == null || v === '') return ''
  if (typeof v !== 'string' || v.length > 300) return null
  try {
    return new URL(v).protocol === 'https:' ? v.trim() : null
  } catch {
    return null
  }
}

/** Checks the profile form. Returns the clean profile or the names of the fields that are wrong. */
export function cleanProfile(input: ProfileInput):
  | { ok: true; profile: { firstName: string; lastName: string; phone: string; country: string | null; city: string | null; linkedin: string | null; website: string | null; github: string | null } }
  | { ok: false; fields: string[] } {
  const firstName = text(input.firstName, 100)
  const lastName = text(input.lastName, 100)
  const phone = text(input.phone, 40)
  const country = input.country == null ? '' : text(input.country, 80)
  const city = input.city == null ? '' : text(input.city, 80)
  const [linkedin, website, github] = [url(input.linkedin), url(input.website), url(input.github)]
  const bad = Object.entries({ firstName, lastName, phone, country, city, linkedin, website, github })
    .filter(([k, v]) => v === null || (['firstName', 'lastName', 'phone'].includes(k) && v === ''))
    .map(([k]) => k)
  if (bad.length) return { ok: false, fields: bad }
  return {
    ok: true,
    profile: { firstName: firstName!, lastName: lastName!, phone: phone!, country: country || null, city: city || null, linkedin: linkedin || null, website: website || null, github: github || null },
  }
}

async function inputsFor(userId: string, job: { id: string }): Promise<PlanInputs & { resumeText: string }> {
  const [user, resume, profile, kit] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.resume.findUnique({ where: { userId } }),
    prisma.applyProfile.findUnique({ where: { userId } }),
    prisma.applicationKit.findUnique({ where: { userId_jobId: { userId, jobId: job.id } }, select: { coverLetter: true } }),
  ])
  if (!resume) throw new AutoApplyError('no_resume')
  return {
    email: user?.email ?? '',
    profile,
    resumeStamp: String(resume.updatedAt.getTime()),
    resumeText: resume.text,
    coverLetter: kit?.coverLetter ?? null,
  }
}

export type PrepareDeps = { findJob: (slug: string) => Promise<KitJob | null>; fetchJob: (ref: { board: string; jobId: string }) => Promise<GhJob | null> }
const prepareDeps: PrepareDeps = { findJob: findKitJob, fetchJob: (ref) => fetchGreenhouseJob(ref) }

/** Reads the employer's form and writes a draft with every answer we can fill from the user's own data. Costs nothing. */
export async function prepareApplication(userId: string, jobSlug: string, deps: PrepareDeps = prepareDeps) {
  const job = await deps.findJob(jobSlug)
  if (!job) throw new AutoApplyError('job_not_found')
  const ref = parseGreenhouseUrl(job.applyUrl)
  if (!ref || !job.applyUrl) throw new AutoApplyError('unsupported_employer')

  const existing = await prisma.autoApplication.findFirst({
    where: { userId, jobId: job.id, status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) {
    if (existing.status === 'draft') return existing
    throw new AutoApplyError('already_exists', { id: existing.id, status: existing.status })
  }

  const inputs = await inputsFor(userId, job)
  const gh = await deps.fetchJob(ref)
  if (!gh) throw new AutoApplyError('form_unavailable')
  const plan = buildPlan(gh, ref, inputs)
  return prisma.autoApplication.create({
    data: {
      userId, jobId: job.id, jobSlug, jobTitle: job.title, companyName: job.company, applyUrl: job.applyUrl,
      board: ref.board, ghJobId: ref.jobId, plan: plan as never,
    },
  })
}

async function ownDraft(userId: string, id: string) {
  const app = await prisma.autoApplication.findFirst({ where: { id, userId } })
  if (!app) throw new AutoApplyError('not_found')
  if (app.status !== 'draft') throw new AutoApplyError('not_editable')
  return app
}

/** Saves the profile and the user's answers into the draft. Returns the draft and what is still missing. */
export async function saveDraft(
  userId: string,
  id: string,
  body: { profile?: ProfileInput; answers?: Record<string, unknown>; consent?: unknown },
) {
  const app = await ownDraft(userId, id)
  let plan = app.plan as unknown as Plan
  const errors: Record<string, string> = {}

  if (body.profile) {
    const clean = cleanProfile(body.profile)
    if (!clean.ok) throw new AutoApplyError('invalid', { fields: clean.fields })
    await prisma.applyProfile.upsert({ where: { userId }, create: { userId, ...clean.profile }, update: clean.profile })
    const inputs = await inputsFor(userId, { id: app.jobId })
    plan = refreshProfileFields(plan, inputs)
  }
  if (body.answers) {
    const applied = applyAnswers(plan, body.answers)
    plan = applied.plan
    Object.assign(errors, applied.errors)
  }
  if (body.consent !== undefined) plan = { ...plan, consentGiven: body.consent === true }

  const saved = await prisma.autoApplication.update({ where: { id }, data: { plan: plan as never } })
  return { application: saved, plan, errors, missing: missingFields(plan).map((f) => f.key), hash: planHash(plan) }
}

/** The user approves exactly the plan they reviewed (`hash`); anything incomplete or changed since is refused. */
export async function approveApplication(userId: string, id: string, hash: unknown) {
  const app = await ownDraft(userId, id)
  const plan = app.plan as unknown as Plan
  if (missingFields(plan).length > 0) throw new AutoApplyError('incomplete')
  if (plan.needsConsent && !plan.consentGiven) throw new AutoApplyError('consent_required')
  if (typeof hash !== 'string' || hash !== planHash(plan)) throw new AutoApplyError('changed')

  const cost = getAutoApplyCredits()
  if ((await getBalance(userId)) < cost) throw new AutoApplyError('insufficient_credits', { cost })
  if ((await countToday(userId)) >= MAX_APPLICATIONS_PER_USER_PER_DAY) throw new AutoApplyError('daily_limit')

  const claimed = await prisma.autoApplication.updateMany({
    where: { id, userId, status: 'draft' },
    data: { status: 'approved', planHash: hash, approvedAt: new Date() },
  })
  if (claimed.count !== 1) throw new AutoApplyError('not_editable')
  return prisma.autoApplication.findUniqueOrThrow({ where: { id } })
}

export async function cancelApplication(userId: string, id: string) {
  const res = await prisma.autoApplication.updateMany({
    where: { id, userId, status: { in: ['draft', 'approved'] } },
    data: { status: 'cancelled', finishedAt: new Date() },
  })
  if (res.count !== 1) throw new AutoApplyError('not_editable')
}

const startOfDay = () => new Date(Date.now() - 24 * 3600_000)
const countToday = (userId: string) =>
  prisma.autoApplication.count({ where: { userId, status: { in: ['approved', 'submitting', 'submitted'] }, createdAt: { gte: startOfDay() } } })

// ---------------------------------------------------------------------------------------------------------------------
// Worker side

export type DriverRequest = { applyUrl: string; plan: Plan; resumeText: string; live: boolean }
export type ApplyDriver = (req: DriverRequest) => Promise<Outcome>

export type RunResult =
  | { done: 'skipped'; why: 'not_approved' | 'board_busy' }
  | { done: 'dry_run'; outcome: Outcome }
  | { done: 'finished'; status: 'submitted' | 'needs_user' | 'failed'; reason?: string }

const finish = (id: string, data: { status: 'submitted' | 'needs_user' | 'failed'; reason?: string; evidence?: string; charge?: string }) =>
  prisma.autoApplication.update({ where: { id }, data: { ...data, finishedAt: new Date() } })

/**
 * Runs one approved application. With `live: false` it only fills the form and reports (a dry run): nothing is claimed,
 * nothing is sent, nothing is charged. With `live: true` it claims the application first so two workers can never send
 * the same one, then submits, and takes the credits only if the employer confirmed it.
 */
export async function runApplication(id: string, driver: ApplyDriver, opts: { live: boolean }): Promise<RunResult> {
  const app = await prisma.autoApplication.findUnique({ where: { id } })
  if (!app || app.status !== 'approved') return { done: 'skipped', why: 'not_approved' }

  const busy = await prisma.autoApplication.count({
    where: { board: app.board, status: { in: ['submitting', 'submitted'] }, startedAt: { gte: new Date(Date.now() - 3600_000) } },
  })
  if (opts.live && busy >= MAX_PER_BOARD_PER_HOUR) return { done: 'skipped', why: 'board_busy' }

  const plan = app.plan as unknown as Plan
  const stop = async (reason: string, status: 'failed' | 'needs_user' = 'failed'): Promise<RunResult> => {
    if (opts.live) await finish(id, { status, reason })
    return { done: 'finished', status, reason }
  }

  if (opts.live) {
    const claimed = await prisma.autoApplication.updateMany({ where: { id, status: 'approved' }, data: { status: 'submitting', startedAt: new Date() } })
    if (claimed.count !== 1) return { done: 'skipped', why: 'not_approved' }
  }

  // What is about to be sent must be exactly what the user approved, with the résumé they approved.
  if (planHash(plan) !== app.planHash) return stop('plan_changed')
  const resume = await prisma.resume.findUnique({ where: { userId: app.userId } })
  if (!resume || String(resume.updatedAt.getTime()) !== plan.resumeStamp) return stop('resume_changed', 'needs_user')

  const cost = getAutoApplyCredits()
  if (opts.live && (await getBalance(app.userId)) < cost) return stop('insufficient_credits')

  let outcome: Outcome
  try {
    outcome = await driver({ applyUrl: app.applyUrl, plan, resumeText: resume.text, live: opts.live })
  } catch {
    return stop('driver_error')
  }

  if (!opts.live) return { done: 'dry_run', outcome }
  if (outcome.kind === 'needs_user') return stop(outcome.reason, 'needs_user')
  if (outcome.kind === 'failed') return stop(outcome.reason)
  if (outcome.kind === 'dry_run') return stop('driver_did_not_submit')

  // Confirmed by the employer: now, and only now, take the credits.
  const spent = await spendCredits(app.userId, 'auto-apply', cost, `autoapply:${id}`)
  await finish(id, { status: 'submitted', evidence: outcome.evidence.slice(0, 2000), charge: spent.ok ? 'charged' : 'unpaid' })
  return { done: 'finished', status: 'submitted' }
}

/**
 * A worker that died mid-submit leaves an application "submitting". It may or may not have gone through, so it is never
 * retried: it becomes "needs you" (unconfirmed) with no charge, and the user gets the employer's link.
 */
export async function recoverStuckApplications(olderThanMs = 15 * 60_000, now = Date.now()): Promise<number> {
  const res = await prisma.autoApplication.updateMany({
    where: { status: 'submitting', startedAt: { lt: new Date(now - olderThanMs) } },
    data: { status: 'needs_user', reason: 'unconfirmed', finishedAt: new Date(now) },
  })
  return res.count
}
