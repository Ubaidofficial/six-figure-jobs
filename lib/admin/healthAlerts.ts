// Emails the owner when a health check (lib/admin/health.ts) turns bad, again once a day while it stays bad, and once
// when it recovers (owner's choice, 2026-11-24: "build 5": "the console tells you when something breaks"). Run inside
// the app every HEALTH_ALERTS_EVERY_MIN minutes (instrumentation.ts). It watches the data pipeline; it cannot report the
// site itself being down (it runs in the site), which an outside uptime monitor on /api/health does.
//
// Sent to OPS_ALERT_EMAIL, or ALERTS_OWNER_EMAIL when that is unset (both environment settings, so no address lives in
// the code), through the same sender as the job alert emails. Nothing is sent while no address or email provider is
// set; the checks still run and the console shows their state. What was already reported is kept in SiteConfig
// (ALERT_STATE_KEY), so a restart or a second container does not send the same email twice in a row.
import { prisma } from '../prisma'
import { sendMail, type SendMail } from '../alerts/service'
import { getSiteUrl } from '../seo/site'
import { evaluateHealth, loadHealthFacts, type Check, type CheckKey } from './health'

export const ALERT_STATE_KEY = 'ops.health.alerts'
export const REMIND_AFTER_MS = 24 * 3_600_000
export const DEFAULT_EVERY_MIN = 30
/** The first run waits this long after the server starts, so a deploy's first minutes do not raise alarms. */
export const START_DELAY_MS = 10 * 60_000

export type AlertState = {
  lastRunAt: string | null
  /** Checks currently reported as bad: when they turned bad and when the owner was last emailed about them. */
  open: Partial<Record<CheckKey, { since: string; lastSentAt: string | null }>>
}

type Env = Record<string, string | undefined>

export function alertRecipient(env: Env = process.env): string | null {
  return env.OPS_ALERT_EMAIL?.trim() || env.ALERTS_OWNER_EMAIL?.trim() || null
}

export function emailConfigured(env: Env = process.env): boolean {
  return Boolean((env.RESEND_API_KEY?.trim() || env.EMAIL_SERVER?.trim()) && env.EMAIL_FROM?.trim())
}

export function healthAlertsEveryMs(env: Env = process.env): number {
  const raw = env.HEALTH_ALERTS_EVERY_MIN
  const min = raw === undefined || raw.trim() === '' ? DEFAULT_EVERY_MIN : Number(raw)
  return Number.isFinite(min) && min > 0 ? Math.max(5, min) * 60_000 : 0
}

export function parseAlertState(raw: string | null | undefined): AlertState {
  try {
    const v = JSON.parse(raw ?? '') as AlertState
    if (v && typeof v === 'object' && v.open && typeof v.open === 'object') return { lastRunAt: v.lastRunAt ?? null, open: v.open }
  } catch {
    // fall through
  }
  return { lastRunAt: null, open: {} }
}

export type AlertPlan = {
  turnedBad: Check[]
  stillBad: Check[]
  remind: Check[]
  /** Checks no longer failing, with how they read now (amber or green). */
  recovered: Array<{ key: CheckKey; since: string; now?: Check }>
  next: AlertState
}

/** Pure: what to report now, given the checks and what was reported before. `sent` = an email will go out. */
export function planAlerts(checks: Check[], prev: AlertState, now: Date, sent: boolean): AlertPlan {
  const nowIso = now.toISOString()
  const bad = checks.filter((c) => c.tone === 'bad')
  const turnedBad = bad.filter((c) => !prev.open[c.key])
  const stillBad = bad.filter((c) => prev.open[c.key])
  const remind = stillBad.filter((c) => {
    const last = prev.open[c.key]?.lastSentAt
    return !last || now.getTime() - new Date(last).getTime() >= REMIND_AFTER_MS
  })
  const badKeys = new Set(bad.map((c) => c.key))
  const recovered = (Object.keys(prev.open) as CheckKey[])
    .filter((k) => !badKeys.has(k))
    .map((key) => ({ key, since: prev.open[key]!.since, now: checks.find((c) => c.key === key) }))

  const willEmail = sent && (turnedBad.length > 0 || remind.length > 0 || recovered.length > 0)
  const open: AlertState['open'] = {}
  for (const c of bad) {
    const before = prev.open[c.key]
    open[c.key] = {
      since: before?.since ?? nowIso,
      lastSentAt: willEmail && (turnedBad.includes(c) || remind.includes(c)) ? nowIso : (before?.lastSentAt ?? null),
    }
  }
  // A recovery the owner was told about but not yet told is over is kept until an email says so (a failed send
  // would otherwise lose it). One never emailed about (no email set up then) is simply dropped.
  if (!willEmail) {
    for (const r of recovered) if (prev.open[r.key]?.lastSentAt) open[r.key] = prev.open[r.key]
  }
  return { turnedBad, stillBad, remind, recovered, next: { lastRunAt: nowIso, open } }
}

const LABELS: Record<CheckKey, string> = {
  live: 'Jobs not expired',
  arrivals: 'New jobs arriving',
  closings: 'Closed jobs removed',
  indexing: 'Google Indexing queue',
  errors: 'Browser errors',
  search: 'Search engines',
}

export function buildAlertEmail(plan: AlertPlan, consoleUrl: string): { subject: string; text: string } | null {
  const problems = [...plan.turnedBad, ...plan.remind.filter((c) => !plan.turnedBad.includes(c))]
  if (problems.length === 0 && plan.recovered.length === 0) return null
  const lines: string[] = []
  for (const c of plan.turnedBad) lines.push(`PROBLEM  ${c.label}: ${c.state}${c.detail ? ` (${c.detail})` : ''}`)
  for (const c of plan.remind) {
    if (!plan.turnedBad.includes(c)) lines.push(`STILL    ${c.label}: ${c.state}${c.detail ? ` (${c.detail})` : ''}`)
  }
  for (const r of plan.recovered) {
    const where = r.now ? ` (now: ${r.now.state})` : ''
    lines.push(`FIXED    ${LABELS[r.key]} is no longer failing${where}; it had been since ${r.since.slice(0, 16).replace('T', ' ')} UTC`)
  }
  const subject =
    problems.length > 0
      ? `Six Figure Jobs alert: ${problems.map((c) => c.label).join(', ')}`
      : `Six Figure Jobs fixed: ${plan.recovered.map((r) => LABELS[r.key]).join(', ')}`
  return { subject, text: [...lines, '', `Open the console: ${consoleUrl}`].join('\n') }
}

const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function runHealthAlerts(
  options: {
    now?: Date
    send?: SendMail
    env?: Env
    loadChecks?: (now: number) => Promise<Check[]>
    loadState?: () => Promise<string | null>
    saveState?: (value: string) => Promise<void>
    consoleUrl?: string
  } = {},
): Promise<{ plan: AlertPlan; emailed: boolean }> {
  const now = options.now ?? new Date()
  const env = options.env ?? process.env
  const send = options.send ?? sendMail
  const checks = await (options.loadChecks ?? (async (t: number) => evaluateHealth(await loadHealthFacts(t), t)))(now.getTime())
  const prev = parseAlertState(
    await (options.loadState ?? (async () => (await prisma.siteConfig.findUnique({ where: { key: ALERT_STATE_KEY } }))?.value ?? null))(),
  )
  const to = alertRecipient(env)
  const canSend = Boolean(to) && emailConfigured(env)
  let plan = planAlerts(checks, prev, now, canSend)
  const mail = buildAlertEmail(plan, options.consoleUrl ?? `${getSiteUrl()}/ubaid93`)
  let emailed = false
  if (mail && canSend && to) {
    try {
      await send({
        to,
        subject: mail.subject,
        text: mail.text,
        html: `<pre style="font:14px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap">${escapeHtml(mail.text)}</pre>`,
      })
      emailed = true
    } catch (error) {
      console.error('[health-alerts] email failed:', error instanceof Error ? error.message.split('\n')[0] : error)
      // Not sent: keep the old "last sent" times so the next run tries again.
      plan = planAlerts(checks, prev, now, false)
    }
  }
  const save =
    options.saveState ??
    (async (value: string) => {
      await prisma.siteConfig.upsert({ where: { key: ALERT_STATE_KEY }, update: { value }, create: { key: ALERT_STATE_KEY, value } })
    })
  await save(JSON.stringify(plan.next))
  return { plan, emailed }
}
