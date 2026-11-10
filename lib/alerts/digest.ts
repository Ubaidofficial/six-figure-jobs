// lib/alerts/digest.ts
// Pure parts of the alert emails: when one is due, which jobs go in it, and the emails themselves (confirmation and
// digest). No database or network, so every rule here is unit-tested.
//
// Job titles and company names are written by employers: every value put into HTML is escaped.

import { DIGEST_SIZE, DUE_AFTER_MS, LOOKBACK_MS, MAX_JOBS_PER_COMPANY, type AlertFrequency } from './config'

export type DigestJob = {
  id: string
  title: string
  company: string
  salary: string | null
  location: string | null
  url: string
}

export type AlertLinks = {
  /** The alert's own page: confirm, change frequency, unsubscribe. */
  manage: string
  /** RFC 8058 one-click unsubscribe target (POST). */
  unsubscribe: string
  /** The same search on the site. */
  search: string
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Timing                                                                                                             */
/* ----------------------------------------------------------------------------------------------------------------- */

export function isDue(alert: { frequency: string; lastSentAt: Date | null }, now: Date): boolean {
  if (!alert.lastSentAt) return true
  return now.getTime() - alert.lastSentAt.getTime() >= DUE_AFTER_MS[asFrequency(alert.frequency)]
}

/** Jobs added after this go in the next digest: since the last one (or confirmation), at most one lookback back. */
export function newJobsSince(
  alert: { frequency: string; lastSentAt: Date | null; confirmedAt: Date | null },
  now: Date,
): Date {
  const floor = now.getTime() - LOOKBACK_MS[asFrequency(alert.frequency)]
  const from = alert.lastSentAt ?? alert.confirmedAt
  return new Date(Math.max(floor, from ? from.getTime() : floor))
}

export const asFrequency = (v: string): AlertFrequency => (v === 'daily' ? 'daily' : 'weekly')

/* ----------------------------------------------------------------------------------------------------------------- */
/* Picking jobs                                                                                                       */
/* ----------------------------------------------------------------------------------------------------------------- */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(remote|hybrid|on-?site)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/**
 * Candidates (already in the order to show them) to the jobs for one email: one per title at the same company (the
 * same job found on two boards), at most MAX_JOBS_PER_COMPANY per company, at most `limit`.
 */
export function pickDigestJobs<T extends Pick<DigestJob, 'title' | 'company'>>(candidates: T[], limit: number): T[] {
  const seen = new Set<string>()
  const perCompany = new Map<string, number>()
  const out: T[] = []
  for (const job of candidates) {
    if (out.length >= limit) break
    const company = norm(job.company)
    const key = `${norm(job.title)}::${company}`
    if (seen.has(key)) continue
    const n = perCompany.get(company) ?? 0
    if (n >= MAX_JOBS_PER_COMPANY) continue
    seen.add(key)
    perCompany.set(company, n + 1)
    out.push(job)
  }
  return out
}

export const digestSize = (frequency: string) => DIGEST_SIZE[asFrequency(frequency)]

/* ----------------------------------------------------------------------------------------------------------------- */
/* Emails                                                                                                             */
/* ----------------------------------------------------------------------------------------------------------------- */

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Header lines, subjects and the plain-text body must stay on one line each. */
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()

const BRAND = 'Six Figure Jobs'
const INK = '#0e0f0c'
const MUTED = '#5c5c55'
const ACCENT = '#84cc16'

function shell(inner: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f0;padding:24px 12px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px">
<tr><td style="padding:24px">${inner}</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
<tr><td style="padding:16px 24px;font-size:12px;line-height:18px;color:${MUTED}">${footer}</td></tr></table>
</body></html>`
}

function footerHtml(links: AlertLinks, postalAddress: string, why: string): string {
  return `${escapeHtml(why)}<br>
<a href="${escapeHtml(links.manage)}" style="color:${MUTED}">Change frequency</a> ·
<a href="${escapeHtml(links.manage)}" style="color:${MUTED}">Unsubscribe</a><br>
${escapeHtml(BRAND)} · ${escapeHtml(oneLine(postalAddress))}`
}

/** The double opt-in email. Nothing is mailed to the address until its link is used. */
export function buildConfirmationEmail(input: { label: string; frequency: string; links: AlertLinks; postalAddress: string }) {
  const label = oneLine(input.label)
  const freq = asFrequency(input.frequency)
  const subject = `Confirm your job alert: ${label}`
  const text = [
    `Confirm your ${BRAND} alert`,
    '',
    `${label}, ${freq}.`,
    '',
    `Confirm: ${input.links.manage}`,
    '',
    'If you did not sign up, ignore this email: nothing more will be sent.',
    '',
    `${BRAND} · ${oneLine(input.postalAddress)}`,
  ].join('\n')
  const inner = `<p style="font-size:18px;font-weight:600;margin:0 0 8px">Confirm your job alert</p>
<p style="margin:0 0 20px;color:${MUTED}">${escapeHtml(label)}, ${freq}.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(input.links.manage)}" style="display:inline-block;background:${ACCENT};color:#0a0a0a;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">Confirm alert</a></p>
<p style="font-size:14px;color:${MUTED};margin:0">If you did not sign up, ignore this email: nothing more will be sent.</p>`
  const footer = `${escapeHtml(BRAND)} · ${escapeHtml(oneLine(input.postalAddress))}`
  return { subject, text, html: shell(inner, footer) }
}

/** One digest: subject, plain text, HTML and the List-Unsubscribe headers Gmail and Yahoo require of bulk mail. */
export function buildDigestEmail(input: {
  label: string
  frequency: string
  jobs: DigestJob[]
  /** All new matches, when more than the email shows. */
  totalNew: number
  links: AlertLinks
  postalAddress: string
}) {
  const label = oneLine(input.label)
  const n = input.jobs.length
  const subject = `${n} new ${n === 1 ? label.replace(/\bjobs\b/, 'job') : label}`
  const more = input.totalNew > n ? input.totalNew - n : 0
  const why = `You get this ${asFrequency(input.frequency)} because you confirmed a ${BRAND} alert for: ${label}.`

  const text = [
    subject,
    '',
    ...input.jobs.flatMap((j) => [
      oneLine(`${j.title} at ${j.company}`),
      oneLine([j.salary, j.location].filter(Boolean).join(' · ')),
      j.url,
      '',
    ]),
    more > 0 ? `${more} more: ${input.links.search}` : `See all: ${input.links.search}`,
    '',
    '--',
    why,
    `Change frequency or unsubscribe: ${input.links.manage}`,
    `${BRAND} · ${oneLine(input.postalAddress)}`,
  ].join('\n')

  const rows = input.jobs
    .map((j) => {
      const meta = [j.salary ? `<strong style="color:${INK}">${escapeHtml(j.salary)}</strong>` : '', j.location ? escapeHtml(j.location) : '']
        .filter(Boolean)
        .join(' · ')
      return `<tr><td style="padding:14px 0;border-bottom:1px solid #ececE6">
<a href="${escapeHtml(j.url)}" style="font-size:16px;font-weight:600;color:${INK};text-decoration:none">${escapeHtml(oneLine(j.title))}</a>
<div style="font-size:14px;color:${MUTED};margin-top:2px">${escapeHtml(oneLine(j.company))}</div>
${meta ? `<div style="font-size:14px;color:${MUTED};margin-top:2px">${meta}</div>` : ''}
</td></tr>`
    })
    .join('\n')

  const inner = `<p style="font-size:13px;color:${MUTED};margin:0 0 4px">${escapeHtml(BRAND)} alert</p>
<p style="font-size:20px;font-weight:600;margin:0 0 12px">${escapeHtml(subject)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin:20px 0 0"><a href="${escapeHtml(input.links.search)}" style="display:inline-block;background:${ACCENT};color:#0a0a0a;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">${more > 0 ? `See ${more} more` : 'See all matching jobs'}</a></p>`

  return {
    subject,
    text,
    html: shell(inner, footerHtml(input.links, input.postalAddress, why)),
    headers: {
      'List-Unsubscribe': `<${input.links.unsubscribe}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
