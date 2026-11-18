// lib/alerts/digest.ts
// Pure parts of the alert emails: when one is due, which jobs go in it, and the emails themselves (confirmation and
// digest). No database or network, so every rule here is unit-tested.
//
// Job titles and company names are written by employers: every value put into HTML is escaped.

import { fallbackHue, getInitials } from '@/lib/companies/logoFallback'

import { DIGEST_SIZE, DUE_AFTER_MS, LOOKBACK_MS, MAX_JOBS_PER_COMPANY, type AlertFrequency } from './config'

export type DigestJob = {
  id: string
  title: string
  company: string
  salary: string | null
  location: string | null
  url: string
  /** Absolute logo URL, or null for a letter tile. */
  logo?: string | null
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

export const asFrequency = (v: string): AlertFrequency => (v === 'daily' || v === 'instant' ? v : 'weekly')

/** How a frequency reads in an email: "weekly", "daily", "instantly". */
const FREQUENCY_WORD: Record<AlertFrequency, string> = { daily: 'daily', weekly: 'weekly', instant: 'instantly' }

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

/**
 * The double opt-in email. Nothing is mailed to the address until its link is used. The link opens the alert's page,
 * where one more click confirms (a button, because mail scanners open every link), so the email says so up front.
 */
export function buildConfirmationEmail(input: { label: string; frequency: string; links: AlertLinks; postalAddress: string }) {
  const label = oneLine(input.label)
  const frequency = asFrequency(input.frequency)
  const freq = FREQUENCY_WORD[frequency]
  const size = DIGEST_SIZE[frequency]
  const subject = `Confirm your job alert: ${label}`
  const preview = `One more click and new matching jobs arrive ${freq}.`
  const promises = [
    `Up to ${size} new jobs that match this search, ${freq}.`,
    'No email when nothing new has come in.',
    'Unsubscribe from any email in one click.',
  ]
  const text = [
    `Confirm your ${BRAND} alert`,
    '',
    `You asked for: ${label}, ${freq}.`,
    '',
    `Confirm: ${input.links.manage}`,
    '(The link opens a page on our site with one last Confirm button.)',
    '',
    ...promises.map((p) => `- ${p}`),
    '',
    'If you did not sign up, ignore this email: nothing more will be sent.',
    '',
    `${BRAND} · ${oneLine(input.postalAddress)}`,
  ].join('\n')
  const manage = escapeHtml(input.links.manage)
  const inner = `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preview)}</div>
<p style="font-size:15px;font-weight:800;letter-spacing:-0.02em;margin:0 0 20px">six figure jobs</p>
<p style="font-size:20px;font-weight:700;margin:0 0 8px">Confirm your job alert</p>
<p style="margin:0 0 20px;color:${MUTED}">You asked for <strong style="color:${INK}">${escapeHtml(label)}</strong>, ${freq}.</p>
<p style="margin:0 0 8px"><a href="${manage}" style="display:inline-block;background:${ACCENT};color:#0a0a0a;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">Confirm alert</a></p>
<p style="font-size:13px;color:${MUTED};margin:0 0 24px">Opens a page on our site with one last Confirm button.</p>
<p style="font-weight:600;margin:0 0 8px">What you will get</p>
<ul style="margin:0 0 24px;padding-left:20px;color:${MUTED};line-height:22px">${promises.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
<p style="font-size:13px;color:${MUTED};margin:0 0 8px">Button not working? Paste this into your browser:<br><span style="word-break:break-all;color:${INK}">${manage}</span></p>
<p style="font-size:13px;color:${MUTED};margin:0">If you did not sign up, ignore this email: nothing more will be sent.</p>`
  const footer = `${escapeHtml(BRAND)} · ${escapeHtml(oneLine(input.postalAddress))}`
  return { subject, text, html: shell(inner, footer) }
}

/** Inbox preview line: the best-paid job, so the reason to open is visible before opening. */
function previewOf(jobs: DigestJob[]): string {
  const top = jobs[0]
  if (!top) return ''
  return oneLine(`${top.title} at ${top.company}${top.salary ? `, ${top.salary}` : ''}`)
}

/** Company logo on a white tile (a dark logo on a dark tile disappears), or the company's initials. */
function logoCell(j: DigestJob): string {
  const box = 'width:40px;height:40px;border-radius:8px;border:1px solid #ececE6;background:#ffffff'
  if (j.logo && /^https:\/\//.test(j.logo)) {
    return `<img src="${escapeHtml(j.logo)}" width="40" height="40" alt="" style="${box};display:block;object-fit:contain">`
  }
  const hue = fallbackHue(j.company)
  return `<div style="${box};background:hsl(${hue},45%,92%);color:hsl(${hue},45%,28%);font-size:14px;font-weight:700;line-height:40px;text-align:center">${escapeHtml(getInitials(j.company))}</div>`
}

function digestJobRow(j: DigestJob): string {
  const url = escapeHtml(j.url)
  const where = [oneLine(j.company), j.location ? oneLine(j.location) : ''].filter(Boolean).map(escapeHtml).join(' · ')
  const pay = j.salary
    ? `<span style="display:inline-block;margin:8px 8px 0 0;padding:3px 10px;border-radius:999px;background:#ecfccb;color:#365314;font-size:13px;font-weight:700">${escapeHtml(oneLine(j.salary))}</span>`
    : ''
  return `<tr><td style="padding:16px 0;border-top:1px solid #ececE6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="40" valign="top" style="width:40px">${logoCell(j)}</td>
<td valign="top" style="padding-left:14px">
<a href="${url}" style="font-size:16px;font-weight:700;line-height:22px;color:${INK};text-decoration:none">${escapeHtml(oneLine(j.title))}</a>
<div style="font-size:14px;line-height:20px;color:${MUTED};margin-top:2px">${where}</div>
${pay}<a href="${url}" style="display:inline-block;margin-top:8px;font-size:13px;font-weight:600;color:#3f6212">View job &rarr;</a>
</td></tr></table>
</td></tr>`
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
  const why = `You get this ${FREQUENCY_WORD[asFrequency(input.frequency)]} because you confirmed a ${BRAND} alert for: ${label}.`

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

  const rows = input.jobs.map((j) => digestJobRow(j)).join('\n')
  const lead = more > 0 ? `Best paid first. ${more} more on the site.` : 'Best paid first.'

  const inner = `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(previewOf(input.jobs))}</div>
<p style="font-size:15px;font-weight:800;letter-spacing:-0.02em;margin:0 0 20px">six figure jobs</p>
<p style="font-size:13px;color:${MUTED};margin:0 0 4px">Your alert: ${escapeHtml(label)}</p>
<p style="font-size:22px;font-weight:700;margin:0 0 4px">${n} new ${n === 1 ? 'job' : 'jobs'}</p>
<p style="font-size:14px;color:${MUTED};margin:0 0 8px">${escapeHtml(lead)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin:24px 0 0"><a href="${escapeHtml(input.links.search)}" style="display:inline-block;background:${ACCENT};color:#0a0a0a;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${more > 0 ? `See ${more} more` : 'See all matching jobs'}</a></p>`

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
