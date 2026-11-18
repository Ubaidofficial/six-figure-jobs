// lib/alerts/service.ts
// Database side of email job alerts: signing up (double opt-in), acting on an alert's link, and the digest run.

import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { Prisma } from '@prisma/client'
import { createTransport, type Transporter } from 'nodemailer'

import { prisma } from '@/lib/prisma'
import { buildWhere, jobListingSelect } from '@/lib/jobs/queryJobs'
import { buildSalaryText } from '@/lib/jobs/salary'
import { buildJobSlugHref } from '@/lib/jobs/jobSlug'
import { describeJobLocation } from '@/lib/location/jobLocation'
import { createRateLimiter } from '@/lib/jobs/jobReport'
import { getSiteUrl } from '@/lib/seo/site'
import { buildKeywordPlan } from '@/lib/search/keywordPlan'
import { getSearchVocabulary } from '@/lib/search/vocabulary'

import { normalizeEmail } from './email'
import { hasActiveSubscription } from '@/lib/billing/entitlement'

import {
  FREE_MAX_ALERTS_PER_EMAIL,
  MAX_CONFIRMATIONS_PER_EMAIL_PER_DAY,
  PRO_MAX_ALERTS_PER_EMAIL,
  SEND_GAP_MS,
  type AlertFrequency,
} from './config'
import { alertFiltersKey, alertQueryInput, buildAlertLabel, sanitizeAlertFilters, type AlertFilters } from './filters'
import {
  asFrequency,
  buildConfirmationEmail,
  buildDigestEmail,
  digestSize,
  isDue,
  newJobsSince,
  pickDigestJobs,
  type AlertLinks,
  type DigestJob,
} from './digest'

const UTM = 'utm_source=job_alert&utm_medium=email'

/* ----------------------------------------------------------------------------------------------------------------- */
/* Sending                                                                                                            */
/* ----------------------------------------------------------------------------------------------------------------- */

export type OutgoingMail = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }
export type SendMail = (mail: OutgoingMail) => Promise<void>

let transport: Transporter | null = null

/** The email provider refused because a sending limit is reached (its daily quota, or too many requests). */
export class SendLimitError extends Error {}

const RESEND_URL = 'https://api.resend.com/emails'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Resend's HTTPS API (https://resend.com/docs/api-reference/emails/send-email). Railway blocks outbound SMTP below its
 * Pro plan and recommends this instead. A 429 (too many requests, or the plan's daily quota) is retried once after a
 * pause; a second 429 is a SendLimitError. Error messages never include the response body, which can echo the address.
 */
export async function sendViaResend(mail: OutgoingMail, apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, headers: mail.headers }),
    })
    if (res.ok) return
    if (res.status === 429) {
      if (attempt >= 2) throw new SendLimitError('email provider limit reached (HTTP 429)')
      await sleep(1500)
      continue
    }
    throw new Error(`email provider refused the email (HTTP ${res.status}${await resendReason(res)})`)
  }
}

/**
 * Resend's error name and message (https://resend.com/docs/api-reference/errors), on one line, with every email address
 * replaced, so the log says which field or key was refused without recording anyone's address.
 */
async function resendReason(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { name?: unknown; message?: unknown }
    const reason = [body.name, body.message].filter((v) => typeof v === 'string' && v).join(': ')
    const safe = reason.replace(/[^\s<>"'`@]+@[^\s<>"'`]+/g, '[address]').replace(/\s+/g, ' ').trim().slice(0, 300)
    return safe ? ` ${safe}` : ''
  } catch {
    return ''
  }
}

/** EMAIL_FROM with the site's name in front when it is a bare address, so inboxes show "Six Figure Jobs", not the address. */
export function senderWithName(from: string | undefined): string {
  const f = String(from ?? '').trim()
  return f && !f.includes('<') ? `Six Figure Jobs <${f}>` : f
}

/**
 * Sends from EMAIL_FROM through Resend's API when RESEND_API_KEY is set, else through the SMTP server in EMAIL_SERVER.
 * With ALERTS_DRY_RUN_DIR set, writes each email there as HTML and text instead (to preview them); nothing is sent.
 */
export const sendMail: SendMail = async (mail) => {
  const dir = process.env.ALERTS_DRY_RUN_DIR?.trim()
  if (dir) {
    await mkdir(dir, { recursive: true })
    const base = path.join(dir, `${Date.now()}-${randomBytes(3).toString('hex')}`)
    await writeFile(`${base}.html`, mail.html)
    await writeFile(`${base}.txt`, [`To: ${mail.to}`, `Subject: ${mail.subject}`, ...Object.entries(mail.headers ?? {}).map(([k, v]) => `${k}: ${v}`), '', mail.text].join('\n'))
    return
  }
  const from = senderWithName(process.env.EMAIL_FROM)
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (apiKey) return sendViaResend(mail, apiKey, from)
  transport ??= createTransport(String(process.env.EMAIL_SERVER))
  const result = await transport.sendMail({ from, ...mail })
  // Deliberately generic: the transport's message can contain the recipient address.
  if ((result.rejected ?? []).length > 0) throw new Error('alert email was not accepted')
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Links                                                                                                              */
/* ----------------------------------------------------------------------------------------------------------------- */

/** The same search as a /jobs URL (the parameters that page reads), newest first. */
export function searchUrlFor(f: AlertFilters, base = getSiteUrl()): string {
  const u = new URL('/jobs', base)
  for (const r of f.roleSlugs ?? []) u.searchParams.append('role', r)
  for (const s of f.seniorityLevels ?? []) u.searchParams.append('seniority', s)
  for (const c of f.companySizeBuckets ?? []) u.searchParams.append('companySize', c)
  if (f.countryCode) u.searchParams.set('country', f.countryCode)
  if (f.remoteMode || f.remoteOnly) u.searchParams.set('remoteMode', f.remoteMode ?? 'remote')
  if (f.remoteRegion) u.searchParams.set('remoteRegion', f.remoteRegion)
  if (f.keyword) u.searchParams.set('q', f.keyword)
  if (f.tech) u.searchParams.set('tech', f.tech)
  if (f.visaSponsorship) u.searchParams.set('visa', '1')
  if (f.minAnnual) u.searchParams.set('minSalary', String(f.minAnnual))
  u.searchParams.set('sort', 'recent')
  return `${u.toString()}&${UTM}`
}

export function linksFor(alert: { token: string; filters: AlertFilters }, base = getSiteUrl()): AlertLinks {
  return {
    manage: `${base}/alerts/${alert.token}`,
    unsubscribe: `${base}/api/alerts/${alert.token}`,
    search: searchUrlFor(alert.filters, base),
  }
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Signing up                                                                                                         */
/* ----------------------------------------------------------------------------------------------------------------- */

export { normalizeEmail }

/** A site path ("/jobs/data-engineer"), without query or fragment, or null. Kept short: it is only for counting. */
export function readSource(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const path = raw.split(/[?#]/)[0]
  return /^\/[a-z0-9\-/._~%]{0,199}$/i.test(path) ? path : null
}

const confirmationsPerEmail = createRateLimiter()
const DAY_MS = 24 * 60 * 60 * 1000

export type SubscribeResult = 'confirmation_sent' | 'nothing_to_do' | 'limited' | 'invalid' | 'pro_required'

/**
 * Creates (or revives) an alert and mails the confirmation link. The visitor always sees the same message whatever
 * this returns, so the form cannot be used to learn whether an address already has an alert.
 */
export async function subscribe(input: {
  email: unknown
  filters: unknown
  frequency: unknown
  /** The page the form was on. */
  source?: unknown
  /**
   * True only when the caller has verified that the visitor is signed in, holds an active subscription and that this
   * address is their own (app/api/alerts/route.ts). It unlocks instant alerts and the higher cap.
   */
  pro?: boolean
  send?: SendMail
}): Promise<SubscribeResult> {
  const email = normalizeEmail(input.email)
  const filters = sanitizeAlertFilters(input.filters)
  if (!email || !filters) return 'invalid'
  if (input.frequency === 'instant' && !input.pro) return 'pro_required'
  const frequency: AlertFrequency =
    input.frequency === 'instant' ? 'instant' : input.frequency === 'daily' ? 'daily' : 'weekly'
  const filtersKey = alertFiltersKey(filters)

  const existing = await prisma.jobAlert.findUnique({ where: { email_filtersKey: { email, filtersKey } } })
  if (existing?.status === 'active') return 'nothing_to_do'

  if (!existing) {
    const held = await prisma.jobAlert.count({ where: { email, status: { not: 'unsubscribed' } } })
    if (held >= (input.pro ? PRO_MAX_ALERTS_PER_EMAIL : FREE_MAX_ALERTS_PER_EMAIL)) return 'limited'
  }
  if (!confirmationsPerEmail.allow(email, MAX_CONFIRMATIONS_PER_EMAIL_PER_DAY, DAY_MS)) return 'limited'

  const alert = existing
    ? await prisma.jobAlert.update({ where: { id: existing.id }, data: { status: 'pending', frequency } })
    : await prisma.jobAlert.create({
        data: {
          email,
          filters: filters as Prisma.InputJsonValue,
          filtersKey,
          frequency,
          source: readSource(input.source),
          token: randomBytes(32).toString('hex'),
        },
      })

  const mail = buildConfirmationEmail({
    label: buildAlertLabel(filters),
    frequency,
    links: linksFor({ token: alert.token, filters }),
    postalAddress: String(process.env.ALERTS_POSTAL_ADDRESS),
  })
  await (input.send ?? sendMail)({ to: email, ...mail })
  return 'confirmation_sent'
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* The alert's own page                                                                                               */
/* ----------------------------------------------------------------------------------------------------------------- */

export const isToken = (t: unknown): t is string => typeof t === 'string' && /^[a-f0-9]{64}$/.test(t)

export async function findAlertByToken(token: string) {
  if (!isToken(token)) return null
  return prisma.jobAlert.findUnique({ where: { token } })
}

export type AlertAction = 'confirm' | 'unsubscribe' | 'daily' | 'weekly'
export const isAlertAction = (a: unknown): a is AlertAction =>
  a === 'confirm' || a === 'unsubscribe' || a === 'daily' || a === 'weekly'

/** Applies one action from the alert's page or email. Returns false when the token matches no alert. */
export async function applyAlertAction(token: string, action: AlertAction, now = new Date()): Promise<boolean> {
  const alert = await findAlertByToken(token)
  if (!alert) return false
  const data: Prisma.JobAlertUpdateInput =
    action === 'unsubscribe'
      ? { status: 'unsubscribed', unsubscribedAt: alert.status === 'unsubscribed' ? alert.unsubscribedAt : now }
      : action === 'confirm'
        ? { status: 'active', confirmedAt: alert.confirmedAt ?? now, unsubscribedAt: null }
        : { frequency: action }
  await prisma.jobAlert.update({ where: { id: alert.id }, data })
  return true
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* The digest run                                                                                                     */
/* ----------------------------------------------------------------------------------------------------------------- */

/** Jobs read per alert before de-duplicating and capping per company. */
const CANDIDATES = 80

type ListingRow = Prisma.JobGetPayload<{ select: typeof jobListingSelect }>

function toDigestJob(job: ListingRow, base: string): DigestJob {
  return {
    id: job.id,
    title: job.title,
    company: job.companyRef?.name || job.company,
    salary: buildSalaryText(job as never),
    location: describeJobLocation(job as never).text || null,
    url: `${base}${buildJobSlugHref(job as never)}?${UTM}&utm_campaign=digest`,
  }
}

export type DigestRunStats = {
  active: number
  due: number
  sent: number
  nothingNew: number
  failed: number
  /** Due alerts not tried because the email provider's limit was reached; they go out on the next run, first. */
  leftForNextRun: number
  /** Instant alerts whose owner no longer has an active subscription: switched to daily instead of sent now. */
  demoted: number
}

/** Which of these addresses belong to a user with an active subscription (matched by sign-in email, any case). */
async function proEmailsAmong(emails: string[]): Promise<Set<string>> {
  const pro = new Set<string>()
  for (const email of new Set(emails)) {
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })
    if (user && (await hasActiveSubscription(user.id))) pro.add(email)
  }
  return pro
}

/**
 * Mails every active alert that is due the jobs added since its last email that it has not sent before, best paid
 * first. An alert with nothing new gets no email (and stays due, so it goes out as soon as something matches).
 */
export async function runDigests(
  opts: {
    now?: Date
    send?: SendMail
    log?: (line: string) => void
    /** Build and "send" (to `send`) but record nothing: the same alerts stay due and no job is marked as sent. */
    dryRun?: boolean
    /** Which alerts this run handles. The daily run does daily and weekly; the 15-minute run does only 'instant'. */
    frequencies?: AlertFrequency[]
  } = {},
): Promise<DigestRunStats> {
  const now = opts.now ?? new Date()
  const send = opts.send ?? sendMail
  const log = opts.log ?? (() => {})
  const base = getSiteUrl()
  const postalAddress = String(process.env.ALERTS_POSTAL_ADDRESS)
  const stats: DigestRunStats = { active: 0, due: 0, sent: 0, nothingNew: 0, failed: 0, leftForNextRun: 0, demoted: 0 }
  const wanted = opts.frequencies ?? ['daily', 'weekly']

  // Longest-waiting first (never sent, then oldest last email), so when a daily sending limit cuts a run short, the
  // alerts it skipped are the first to go out the next day instead of the same ones missing out every day.
  const active = await prisma.jobAlert.findMany({ where: { status: 'active', frequency: { in: wanted } } })
  stats.active = active.length
  // Instant is a Pro feature: an instant alert whose owner has stopped paying goes back to daily (it then goes out with
  // the daily run) instead of being mailed every 15 minutes for free.
  const instant = active.filter((a) => a.frequency === 'instant')
  const lapsed = new Set<string>()
  if (instant.length > 0) {
    const pro = await proEmailsAmong(instant.map((a) => a.email))
    for (const a of instant) if (!pro.has(a.email)) lapsed.add(a.id)
    stats.demoted = lapsed.size
    if (lapsed.size > 0 && !opts.dryRun) {
      await prisma.jobAlert.updateMany({ where: { id: { in: [...lapsed] } }, data: { frequency: 'daily' } })
    }
  }
  const due = active
    .filter((a) => !lapsed.has(a.id))
    .filter((a) => isDue(a, now))
    .sort((a, b) => (a.lastSentAt?.getTime() ?? 0) - (b.lastSentAt?.getTime() ?? 0) || a.id.localeCompare(b.id))
  stats.due = due.length

  let sentSoFar = 0
  for (const [index, alert] of due.entries()) {
    try {
      const filters = sanitizeAlertFilters(alert.filters)
      if (!filters) continue
      // Same keyword reading as the listing (aliases, typo corrections); the plain words if the vocabulary fails.
      const keywordPlan = filters.keyword
        ? buildKeywordPlan(filters.keyword, await getSearchVocabulary().catch(() => null))
        : undefined
      const where: Prisma.JobWhereInput = {
        AND: [
          buildWhere({ ...alertQueryInput(filters), keywordPlan }),
          { createdAt: { gt: newJobsSince(alert, now), lte: now } },
        ],
      }
      const [totalNew, rows] = await Promise.all([
        prisma.job.count({ where }),
        prisma.job.findMany({
          where,
          select: jobListingSelect,
          orderBy: [{ maxAnnual: 'desc' }, { minAnnual: 'desc' }, { createdAt: 'desc' }],
          take: CANDIDATES,
        }),
      ])
      const already = new Set(
        (
          await prisma.jobAlertSent.findMany({
            where: { alertId: alert.id, jobId: { in: rows.map((r) => r.id) } },
            select: { jobId: true },
          })
        ).map((r) => r.jobId),
      )
      const jobs = pickDigestJobs(
        rows.filter((r) => !already.has(r.id)).map((r) => toDigestJob(r, base)),
        digestSize(alert.frequency),
      )
      if (jobs.length === 0) {
        stats.nothingNew++
        continue
      }

      const mail = buildDigestEmail({
        label: buildAlertLabel(filters),
        frequency: asFrequency(alert.frequency),
        jobs,
        totalNew: Math.max(totalNew - already.size, jobs.length),
        links: linksFor({ token: alert.token, filters }, base),
        postalAddress,
      })
      if (sentSoFar > 0) await sleep(SEND_GAP_MS)
      await send({ to: alert.email, ...mail })
      sentSoFar++
      stats.sent++
      if (opts.dryRun) continue
      await prisma.$transaction([
        prisma.jobAlertSent.createMany({ data: jobs.map((j) => ({ alertId: alert.id, jobId: j.id })), skipDuplicates: true }),
        prisma.jobAlert.update({ where: { id: alert.id }, data: { lastSentAt: now } }),
      ])
    } catch (err) {
      if (err instanceof SendLimitError) {
        // Nothing more will go through today: stop, and leave the rest due for the next run.
        stats.leftForNextRun = due.length - index
        log(`[alerts] ${err.message}; ${stats.leftForNextRun} due alerts left for the next run`)
        break
      }
      stats.failed++
      // The alert id only: never the address.
      log(`[alerts] alert ${alert.id} failed: ${err instanceof Error ? err.message.split('\n')[0] : 'unknown error'}`)
    }
  }
  return stats
}
