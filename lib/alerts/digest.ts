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
  /** When we listed it (ISO), for "2d ago". */
  listedAt?: string
  remote?: boolean
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
const LINE = '#e7e7e1'

// Dark mode. Apple Mail, Outlook for Mac/iOS and others apply these when the reader's device is dark; Outlook.com uses the
// [data-ogsc]/[data-ogsb] hooks. Gmail ignores them and recolours on its own, so the design also has to survive that: the
// wordmark is text (an image of dark text vanishes on a dark inbox), and company logos sit on a white tile painted with a
// background image, which Gmail does not invert.
const HEAD = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
a{text-decoration:none}
@media (prefers-color-scheme:dark){
.x-bg{background:#0c0d0b!important}
.x-card{background:#16171a!important;border-color:#2a2b2f!important}
.x-job{background:#1c1d21!important;border-color:#2a2b2f!important}
.x-ink{color:#f4f4f1!important}
.x-muted{color:#a6a69e!important}
.x-pill{background:#25340f!important;color:#d9f99d!important}
.x-chip{background:#1d2a3f!important;color:#c7dcff!important}
.x-badge{background:#25340f!important;color:#d9f99d!important}
.x-link{color:#a3e635!important}
.x-rule{border-color:#2a2b2f!important}
}
[data-ogsc] .x-ink{color:#f4f4f1!important}
[data-ogsc] .x-muted{color:#a6a69e!important}
[data-ogsc] .x-link{color:#a3e635!important}
[data-ogsb] .x-bg{background:#0c0d0b!important}
[data-ogsb] .x-card{background:#16171a!important}
[data-ogsb] .x-job{background:#1c1d21!important}
@media (max-width:520px){.x-pad{padding:20px!important}.x-h1{font-size:22px!important}}
</style>`

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

function shell(inner: string, footer: string, preview: string): string {
  return `<!doctype html><html lang="en"><head>${HEAD}<title>${escapeHtml(BRAND)}</title></head>
<body class="x-bg" style="margin:0;padding:0;background:#f3f4ef;font-family:${FONT};color:${INK};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(preview)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="x-bg" style="background:#f3f4ef"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 4px 16px">${wordmark()}</td></tr>
<tr><td class="x-card x-pad" style="background:#ffffff;border:1px solid ${LINE};border-radius:20px;padding:28px">${inner}</td></tr>
<tr><td class="x-muted" style="padding:20px 8px 0;font-size:12px;line-height:19px;color:${MUTED}">${footer}</td></tr>
</table></td></tr></table></body></html>`
}

/** The brand as text, so no dark inbox can hide it, with the $100k+ badge in the site's lime. */
function wordmark(): string {
  return `<span class="x-ink" style="font-size:19px;font-weight:800;letter-spacing:-0.03em;color:${INK}">six figure jobs</span>
<span class="x-badge" style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:#ecfccb;color:#3f6212;font-size:11px;font-weight:700;vertical-align:2px">$100k+</span>`
}

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:${ACCENT};color:#0a0a0a;font-size:15px;font-weight:700;padding:14px 24px;border-radius:999px;mso-padding-alt:0">${escapeHtml(label)}</a>`

function footerHtml(links: AlertLinks, postalAddress: string, why: string): string {
  const link = (href: string, label: string) => `<a href="${escapeHtml(href)}" class="x-muted" style="color:${MUTED};text-decoration:underline">${label}</a>`
  return `${escapeHtml(why)}<br>
${link(links.manage, 'Change frequency')} &nbsp;·&nbsp; ${link(links.manage, 'Unsubscribe')}<br>
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
    'Every job shows its pay. No email when nothing new has come in.',
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
  const tick = `<span class="x-pill" style="display:inline-block;width:20px;height:20px;border-radius:999px;background:#ecfccb;color:#3f6212;font-size:12px;font-weight:800;line-height:20px;text-align:center">&#10003;</span>`
  const inner = `<p class="x-muted" style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED}">One step left</p>
<h1 class="x-ink x-h1" style="margin:0 0 10px;font-size:26px;line-height:32px;font-weight:800;letter-spacing:-0.02em;color:${INK}">Confirm your job alert</h1>
<p class="x-muted" style="margin:0 0 24px;font-size:15px;line-height:23px;color:${MUTED}">You asked for <strong class="x-ink" style="color:${INK}">${escapeHtml(label)}</strong>, ${freq}.</p>
<p style="margin:0 0 10px">${button(input.links.manage, 'Confirm alert')}</p>
<p class="x-muted" style="margin:0 0 28px;font-size:13px;line-height:19px;color:${MUTED}">Opens a page on our site with one last Confirm button.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="x-job" style="background:#f8f9f4;border:1px solid ${LINE};border-radius:14px"><tr><td style="padding:18px 20px">
<p class="x-ink" style="margin:0 0 12px;font-size:14px;font-weight:700;color:${INK}">What you will get</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${promises
    .map((p) => `<tr><td width="30" valign="top" style="width:30px;padding:0 0 10px">${tick}</td><td class="x-muted" valign="top" style="padding:0 0 10px;font-size:14px;line-height:20px;color:${MUTED}">${escapeHtml(p)}</td></tr>`)
    .join('')}</table>
</td></tr></table>
<p class="x-muted" style="margin:24px 0 8px;font-size:12px;line-height:18px;color:${MUTED}">Button not working? Paste this into your browser:<br><span class="x-ink" style="word-break:break-all;color:${INK}">${manage}</span></p>
<p class="x-muted" style="margin:0;font-size:12px;line-height:18px;color:${MUTED}">If you did not sign up, ignore this email: nothing more will be sent.</p>`
  const footer = `${escapeHtml(BRAND)} · ${escapeHtml(oneLine(input.postalAddress))}`
  return { subject, text, html: shell(inner, footer, preview) }
}

/** Inbox preview line: the best-paid job, so the reason to open is visible before opening. */
function previewOf(jobs: DigestJob[]): string {
  const top = jobs[0]
  if (!top) return ''
  return oneLine(`${top.title} at ${top.company}${top.salary ? `, ${top.salary}` : ''}`)
}

/** "today", "1d ago", "5d ago" from when we listed the job; empty when unknown. */
export function listedAgo(iso: string | undefined, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(t)) return ''
  const days = Math.floor((now - t) / 86_400_000)
  return days <= 0 ? 'today' : `${days}d ago`
}

/**
 * Company logo on a white tile (a dark logo on a dark tile disappears), or the company's initials. The tile's white is
 * also a background image, which Gmail's dark mode leaves alone.
 */
function logoCell(j: DigestJob): string {
  const box = `width:44px;height:44px;border-radius:10px;border:1px solid ${LINE};background:#ffffff;background-image:linear-gradient(#ffffff,#ffffff)`
  if (j.logo && /^https:\/\//.test(j.logo)) {
    return `<img src="${escapeHtml(j.logo)}" width="44" height="44" alt="" style="${box};display:block;object-fit:contain">`
  }
  const hue = fallbackHue(j.company)
  return `<div style="${box};background:hsl(${hue},45%,92%);background-image:linear-gradient(hsl(${hue},45%,92%),hsl(${hue},45%,92%));color:hsl(${hue},45%,28%);font-size:15px;font-weight:800;line-height:44px;text-align:center">${escapeHtml(getInitials(j.company))}</div>`
}

function digestJobRow(j: DigestJob, now: number): string {
  const url = escapeHtml(j.url)
  const where = [oneLine(j.company), j.location ? oneLine(j.location) : ''].filter(Boolean).map(escapeHtml).join(' · ')
  const chips = [
    j.salary
      ? `<span class="x-pill" style="display:inline-block;margin:10px 6px 0 0;padding:4px 11px;border-radius:999px;background:#ecfccb;color:#365314;font-size:13px;font-weight:800">${escapeHtml(oneLine(j.salary))}</span>`
      : '',
    j.remote
      ? `<span class="x-chip" style="display:inline-block;margin:10px 6px 0 0;padding:4px 10px;border-radius:999px;background:#eff6ff;color:#1e40af;font-size:12px;font-weight:700">Remote</span>`
      : '',
    listedAgo(j.listedAt, now)
      ? `<span class="x-muted" style="display:inline-block;margin:10px 6px 0 0;font-size:12px;color:${MUTED}">${escapeHtml(listedAgo(j.listedAt, now))}</span>`
      : '',
  ].join('')
  return `<tr><td style="padding:0 0 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="x-job" style="background:#fbfbf8;border:1px solid ${LINE};border-radius:14px"><tr>
<td width="44" valign="top" style="width:44px;padding:16px 0 16px 16px">${logoCell(j)}</td>
<td valign="top" style="padding:14px 16px 16px 14px">
<a href="${url}" class="x-ink" style="font-size:16px;font-weight:700;line-height:22px;color:${INK}">${escapeHtml(oneLine(j.title))}</a>
<div class="x-muted" style="font-size:14px;line-height:20px;color:${MUTED};margin-top:2px">${where}</div>
${chips}
<div style="margin-top:10px"><a href="${url}" class="x-link" style="font-size:13px;font-weight:700;color:#3f6212">View job &rarr;</a></div>
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
  /** For "2d ago"; defaults to now. */
  now?: number
}) {
  const label = oneLine(input.label)
  const n = input.jobs.length
  const subject = `${n} new ${n === 1 ? label.replace(/\bjobs\b/, 'job') : label}`
  const more = input.totalNew > n ? input.totalNew - n : 0
  const freq = FREQUENCY_WORD[asFrequency(input.frequency)]
  const why = `You get this ${freq} because you confirmed a ${BRAND} alert for: ${label}.`
  const now = input.now ?? Date.now()

  const text = [
    subject,
    '',
    ...input.jobs.flatMap((j) => [
      oneLine(`${j.title} at ${j.company}`),
      oneLine([j.salary, j.location, j.remote ? 'Remote' : '', listedAgo(j.listedAt, now)].filter(Boolean).join(' · ')),
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

  const rows = input.jobs.map((j) => digestJobRow(j, now)).join('\n')
  const lead = more > 0 ? `Best paid first. ${more} more on the site.` : 'Best paid first.'

  const inner = `<p class="x-muted" style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED}">Your alert &middot; ${escapeHtml(freq)}</p>
<p class="x-ink" style="margin:0 0 4px;font-size:15px;font-weight:700;color:${INK}">${escapeHtml(label)}</p>
<h1 class="x-ink x-h1" style="margin:0 0 6px;font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.02em;color:${INK}">${n} new ${n === 1 ? 'job' : 'jobs'}</h1>
<p class="x-muted" style="margin:0 0 22px;font-size:14px;line-height:21px;color:${MUTED}">Every job shows its pay. ${escapeHtml(lead)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin:12px 0 0;text-align:center">${button(input.links.search, more > 0 ? `See ${more} more` : 'See all matching jobs')}</p>`

  return {
    subject,
    text,
    html: shell(inner, footerHtml(input.links, input.postalAddress, why), previewOf(input.jobs)),
    headers: {
      'List-Unsubscribe': `<${input.links.unsubscribe}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
