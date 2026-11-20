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
const INK = '#0b0c0a'
const MUTED = '#62625b'
const ACCENT = '#a3e635'
const LINE = '#e6e6df'
const HERO = '#0f1110'

// Dark mode. Apple Mail, Outlook for Mac/iOS and others apply these when the reader's device is dark; Outlook.com uses the
// [data-ogsc]/[data-ogsb] hooks. Gmail ignores them and recolours on its own, so the design also survives that: the hero
// band is already dark (it looks the same either way), the wordmark is text (an image of dark text vanishes on a dark
// inbox), and company logos sit on a white tile painted with a background image, which Gmail does not invert.
const HEAD = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
a{text-decoration:none}
@media (prefers-color-scheme:dark){
.x-bg{background:#08090a!important}
.x-card{background:#121316!important;border-color:#24252a!important}
.x-job{background:#17181c!important;border-color:#26272c!important}
.x-top{background:#151b0e!important;border-color:#4d7c0f!important}
.x-ink{color:#f5f5f2!important}
.x-muted{color:#9d9d96!important}
.x-pill{color:#bef264!important}
.x-chip{background:#1f2633!important;color:#c7dcff!important}
.x-tag{background:#202126!important;color:#b9b9b2!important}
.x-badge{background:#25340f!important;color:#d9f99d!important}
.x-link{color:#bef264!important}
.x-go{background:#f5f5f2!important;color:#0b0c0a!important}
.x-rule{border-color:#26272c!important}
}
[data-ogsc] .x-ink{color:#f5f5f2!important}
[data-ogsc] .x-muted{color:#9d9d96!important}
[data-ogsc] .x-link{color:#bef264!important}
[data-ogsb] .x-bg{background:#08090a!important}
[data-ogsb] .x-card{background:#121316!important}
[data-ogsb] .x-job{background:#17181c!important}
@media (max-width:520px){.x-pad{padding-left:18px!important;padding-right:18px!important}.x-big{font-size:34px!important;line-height:38px!important}.x-hide{display:none!important}}
</style>`

const FONT = `Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

function shell(body: string, footer: string, preview: string, right: string): string {
  return `<!doctype html><html lang="en"><head>${HEAD}<title>${escapeHtml(BRAND)}</title></head>
<body class="x-bg" style="margin:0;padding:0;background:#f2f3ee;font-family:${FONT};color:${INK};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(preview)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="x-bg" style="background:#f2f3ee"><tr><td align="center" style="padding:28px 12px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 6px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle">${wordmark()}</td>
<td valign="middle" align="right" class="x-muted" style="font-size:12px;font-weight:600;color:${MUTED}">${right}</td>
</tr></table></td></tr>
<tr><td class="x-card" style="background:#ffffff;border:1px solid ${LINE};border-radius:24px;overflow:hidden">${body}</td></tr>
<tr><td class="x-muted" style="padding:22px 10px 0;font-size:12px;line-height:19px;color:${MUTED}">${footer}</td></tr>
</table></td></tr></table></body></html>`
}

/** The brand as text, so no dark inbox can hide it, with the $100k+ badge in the site's lime. */
function wordmark(): string {
  return `<span class="x-ink" style="font-size:19px;font-weight:800;letter-spacing:-0.035em;color:${INK}">six figure jobs</span>
<span class="x-badge" style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:#ecfccb;color:#3f6212;font-size:11px;font-weight:700;vertical-align:2px">$100k+</span>`
}

/** The dark band at the top of the card, with a soft lime glow: the same in light and dark mode. */
function hero(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td class="x-pad" style="background:${HERO};background-image:radial-gradient(120% 140% at 100% 0%,#3f6212 0%,${HERO} 55%);padding:30px 28px 28px;border-radius:24px 24px 0 0">${inner}</td>
</tr></table>`
}

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:${ACCENT};color:#0b0c0a;font-size:15px;font-weight:800;letter-spacing:-0.01em;padding:15px 26px;border-radius:999px;mso-padding-alt:0">${escapeHtml(label)} &rarr;</a>`

const statChip = (value: string, label: string) =>
  `<td style="padding:0 8px 0 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#ffffff1a;background-color:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:14px;padding:10px 14px">
<div style="font-size:16px;font-weight:800;color:#ffffff;letter-spacing:-0.01em">${escapeHtml(value)}</div>
<div style="font-size:11px;font-weight:600;color:#a8b29a;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">${escapeHtml(label)}</div>
</td></tr></table></td>`

function footerHtml(links: AlertLinks, postalAddress: string, why: string): string {
  const pill = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" class="x-tag" style="display:inline-block;margin:0 6px 8px 0;padding:6px 12px;border-radius:999px;background:#e8e9e3;color:#3a3a35;font-size:12px;font-weight:600">${label}</a>`
  return `${pill(links.manage, 'Change frequency')}${pill(links.manage, 'Unsubscribe')}<br>
${escapeHtml(why)}<br>
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
  const tick = `<span class="x-badge" style="display:inline-block;width:22px;height:22px;border-radius:999px;background:#ecfccb;color:#3f6212;font-size:12px;font-weight:800;line-height:22px;text-align:center">&#10003;</span>`
  const top = hero(`<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${ACCENT}">One step left</p>
<h1 class="x-big" style="margin:0 0 12px;font-size:38px;line-height:42px;font-weight:800;letter-spacing:-0.035em;color:#ffffff">Confirm your<br>job alert</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:23px;color:#c9cfc0">You asked for <strong style="color:#ffffff">${escapeHtml(label)}</strong>, ${freq}.</p>
${button(input.links.manage, 'Confirm alert')}
<p style="margin:14px 0 0;font-size:12px;line-height:18px;color:#9aa38e">Opens a page on our site with one last Confirm button.</p>`)
  const bodyHtml = `${top}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="x-pad" style="padding:26px 28px 28px">
<p class="x-muted" style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED}">What you will get</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${promises
    .map((p) => `<tr><td width="34" valign="top" style="width:34px;padding:0 0 14px">${tick}</td><td class="x-ink" valign="top" style="padding:1px 0 14px;font-size:15px;line-height:21px;color:${INK}">${escapeHtml(p)}</td></tr>`)
    .join('')}</table>
<p class="x-muted x-rule" style="margin:10px 0 0;padding-top:18px;border-top:1px solid ${LINE};font-size:12px;line-height:18px;color:${MUTED}">Button not working? Paste this into your browser:<br><span class="x-ink" style="word-break:break-all;color:${INK}">${manage}</span><br>If you did not sign up, ignore this email: nothing more will be sent.</p>
</td></tr></table>`
  const footer = `${escapeHtml(BRAND)} · ${escapeHtml(oneLine(input.postalAddress))}`
  return { subject, text, html: shell(bodyHtml, footer, preview, 'Job alert') }
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

/** The top of a pay range ("$230K – $290K" -> "$290K"), for the hero's "Top pay". */
export function topOfRange(salary: string | null): string | null {
  if (!salary) return null
  const parts = salary.split(/\s[–-]\s|–/).map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : null
}

/**
 * Company logo on a white tile (a dark logo on a dark tile disappears), or the company's initials. The tile's white is
 * also a background image, which Gmail's dark mode leaves alone.
 */
function logoCell(j: DigestJob): string {
  const box = `width:48px;height:48px;border-radius:12px;border:1px solid ${LINE};background:#ffffff;background-image:linear-gradient(#ffffff,#ffffff)`
  if (j.logo && /^https:\/\//.test(j.logo)) {
    return `<img src="${escapeHtml(j.logo)}" width="48" height="48" alt="" style="${box};display:block;object-fit:contain">`
  }
  const hue = fallbackHue(j.company)
  return `<div style="${box};background:hsl(${hue},45%,92%);background-image:linear-gradient(hsl(${hue},45%,92%),hsl(${hue},45%,92%));color:hsl(${hue},45%,28%);font-size:16px;font-weight:800;line-height:48px;text-align:center">${escapeHtml(getInitials(j.company))}</div>`
}

function digestJobRow(j: DigestJob, now: number, featured: boolean): string {
  const url = escapeHtml(j.url)
  const where = [oneLine(j.company), j.location ? oneLine(j.location) : ''].filter(Boolean).map(escapeHtml).join('&nbsp;&middot;&nbsp;')
  const tag = (cls: string, style: string, text: string) =>
    `<span class="${cls}" style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;${style}">${escapeHtml(text)}</span>`
  const ago = listedAgo(j.listedAt, now)
  const tags = [
    j.remote ? tag('x-chip', 'background:#eef4ff;color:#1d4ed8', 'Remote') : '',
    ago ? tag('x-tag', 'background:#f0f0ea;color:#5a5a53;font-weight:600', ago) : '',
  ].join('')
  const pay = j.salary
    ? `<span class="x-pill" style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#3f6212">${escapeHtml(oneLine(j.salary))}</span>`
    : `<span class="x-muted" style="font-size:13px;color:${MUTED}">Pay on the job page</span>`
  const frame = featured
    ? `class="x-top" style="background:#f7fde9;border:2px solid #a3e635;border-radius:18px"`
    : `class="x-job" style="background:#ffffff;border:1px solid ${LINE};border-radius:18px"`
  return `<tr><td style="padding:0 0 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ${frame}><tr><td style="padding:18px">
${featured ? `<div style="margin:0 0 12px"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#0b0c0a;color:${ACCENT};font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase">Top paid</span></div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="48" valign="top" style="width:48px">${logoCell(j)}</td>
<td valign="top" style="padding-left:14px">
<a href="${url}" class="x-ink" style="font-size:17px;font-weight:700;line-height:23px;letter-spacing:-0.01em;color:${INK}">${escapeHtml(oneLine(j.title))}</a>
<div class="x-muted" style="font-size:13px;line-height:19px;color:${MUTED};margin-top:3px">${where}</div>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px"><tr>
<td valign="middle">${pay}<div style="margin-top:8px">${tags}</div></td>
<td valign="bottom" align="right" style="padding-left:10px;white-space:nowrap"><a href="${url}" class="x-go" style="display:inline-block;padding:9px 14px;border-radius:999px;background:#0b0c0a;color:#ffffff;font-size:13px;font-weight:700">View job &rarr;</a></td>
</tr></table>
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

  const topPay = topOfRange(input.jobs[0]?.salary ?? null)
  const remote = input.jobs.filter((j) => j.remote).length
  const stats = [
    topPay ? statChip(topPay, 'Top pay') : '',
    remote ? statChip(String(remote), 'Remote') : '',
    input.totalNew > n ? statChip(String(input.totalNew), 'New in total') : '',
  ].join('')
  const top = hero(`<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${ACCENT}">Your ${escapeHtml(freq)} alert</p>
<p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#d6dccd">${escapeHtml(label)}</p>
<h1 class="x-big" style="margin:0 0 18px;font-size:44px;line-height:48px;font-weight:800;letter-spacing:-0.04em;color:#ffffff">${n} new ${n === 1 ? 'job' : 'jobs'}</h1>
${stats ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr>${stats}</tr></table>` : ''}`)

  const rows = input.jobs.map((j, i) => digestJobRow(j, now, i === 0 && n > 1 && Boolean(j.salary))).join('\n')
  const lead = more > 0 ? `Best paid first · ${more} more on the site` : 'Best paid first · every job shows its pay'

  const bodyHtml = `${top}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="x-pad" style="padding:22px 22px 26px">
<p class="x-muted" style="margin:0 6px 14px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED}">${escapeHtml(lead)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin:14px 0 0;text-align:center">${button(input.links.search, more > 0 ? `See ${more} more` : 'See all matching jobs')}</p>
</td></tr></table>`

  return {
    subject,
    text,
    html: shell(bodyHtml, footerHtml(input.links, input.postalAddress, why), previewOf(input.jobs), `${n} new`),
    headers: {
      'List-Unsubscribe': `<${input.links.unsubscribe}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
