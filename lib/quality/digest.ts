// The weekly quality digest (docs/QUALITY_AGENTS_PLAN.md): what moved since last week, the open findings, and the quality
// agents' pull requests waiting for the owner. Emailed once a week, from Monday 07:00 UTC, to the health alerts' address
// (OPS_ALERT_EMAIL, else ALERTS_OWNER_EMAIL), by the same in-app timer (instrumentation.ts). The week it was sent for is
// claimed in SiteConfig before sending, so two runs cannot both send it; a failed send gives the claim back.
import { alertRecipient, emailConfigured } from '../admin/healthAlerts'
import { sendMail, type SendMail } from '../alerts/service'
import { prisma } from '../prisma'
import { getSiteUrl } from '../seo/site'
import type { CheckResult } from './checks'
import type { SnapshotMetrics } from './snapshot'

export const DIGEST_KEY = 'ops.quality.digest.week'
const DAY = 86_400_000

type Snap = { capturedAt: Date; metrics: SnapshotMetrics; checks: CheckResult[] }
type Finding = { key: string; title: string; severity: string; count: number; status: string; prUrl: string | null; fixedAt: Date | null }

/** The Monday (UTC, YYYY-MM-DD) of the week `now` is in. */
export function weekOf(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** Whether this week's digest is due: from Monday 07:00 UTC, once a week. */
export function digestDue(now: Date, lastWeekSent: string | null): boolean {
  const week = weekOf(now)
  if (lastWeekSent === week) return false
  return now.getTime() >= Date.parse(`${week}T07:00:00Z`)
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

export function buildDigest(latest: Snap, weekAgo: Snap | null, findings: Finding[], consoleUrl: string, now: Date): { subject: string; text: string } {
  const m = latest.metrics
  const p = weekAgo?.metrics
  const fill = (label: string, a: number, b: number | undefined) => `${label} ${a}%${b == null ? '' : ` (${signed(Math.round((a - b) * 10) / 10)})`}`
  const before = new Map((weekAgo?.checks ?? []).map((c) => [c.key, c.count]))
  const moved = latest.checks
    .filter((c) => before.has(c.key) && before.get(c.key) !== c.count)
    .map((c) => `  ${c.key}: ${before.get(c.key)} -> ${c.count}`)
  const active = findings.filter((f) => f.status === 'open' || f.status === 'pr')
  const prs = active.filter((f) => f.status === 'pr' && f.prUrl)
  const fixed = findings.filter((f) => f.status === 'fixed' && f.fixedAt && now.getTime() - f.fixedAt.getTime() < 7 * DAY)
  const lines = [
    `Quality this week (snapshot of ${latest.capturedAt.toISOString().slice(0, 10)}${weekAgo ? `, compared with ${weekAgo.capturedAt.toISOString().slice(0, 10)}` : ''}).`,
    '',
    `Listed jobs ${m.listedJobs}${p ? ` (${signed(m.listedJobs - p.listedJobs)})` : ''}; job pages up ${m.pagesUp}.`,
    `Known: ${fill('role', m.fill.role, p?.fill.role)}, ${fill('country', m.fill.country, p?.fill.country)}, ${fill('work mode', m.fill.workMode, p?.fill.workMode)}, ${fill('company', m.fill.company, p?.fill.company)}.`,
    `Review queue: ${m.review.pay} pay, ${m.review.titles} titles.`,
    '',
    moved.length ? 'Checks that moved:' : 'No check moved this week.',
    ...moved,
    '',
    prs.length ? `Pull requests waiting for you (${prs.length}):` : 'No quality pull request is waiting for you.',
    ...prs.map((f) => `  ${f.title}: ${f.prUrl}`),
    '',
    `Open findings (${active.length}), most severe first:`,
    ...active
      .sort((a, b) => ['high', 'medium', 'low'].indexOf(a.severity) - ['high', 'medium', 'low'].indexOf(b.severity) || b.count - a.count)
      .slice(0, 10)
      .map((f) => `  [${f.severity}] ${f.title}: ${f.count}${f.status === 'pr' ? ' (PR open)' : ''}`),
    ...(fixed.length ? ['', `Fixed this week: ${fixed.map((f) => f.title).join('; ')}.`] : []),
    '',
    `Details: ${consoleUrl}/quality`,
  ]
  return { subject: `Quality this week: ${active.length} open, ${prs.length} PR${prs.length === 1 ? '' : 's'} waiting`, text: lines.join('\n') }
}

const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Sends this week's digest when it is due and email is set up; returns whether it was sent. */
export async function runQualityDigest(
  options: { now?: Date; env?: Record<string, string | undefined>; send?: SendMail } = {},
): Promise<boolean> {
  const now = options.now ?? new Date()
  const env = options.env ?? process.env
  const to = alertRecipient(env)
  if (!to || !emailConfigured(env)) return false
  const week = weekOf(now)
  // Claim the week under a row lock; a claim already made for this week (or a week not yet due) sends nothing.
  const previous = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "SiteConfig" ("key", "value", "updatedAt") VALUES (${DIGEST_KEY}, '', now()) ON CONFLICT ("key") DO NOTHING`
    const rows = await tx.$queryRaw<Array<{ value: string }>>`SELECT "value" FROM "SiteConfig" WHERE "key" = ${DIGEST_KEY} FOR UPDATE`
    const last = rows[0]?.value || null
    if (!digestDue(now, last)) return undefined
    await tx.siteConfig.update({ where: { key: DIGEST_KEY }, data: { value: week } })
    return last ?? ''
  })
  if (previous === undefined) return false

  try {
    const snaps = await prisma.qualitySnapshot.findMany({ where: { capturedAt: { gte: new Date(now.getTime() - 14 * DAY) } }, orderBy: { capturedAt: 'desc' } })
    if (!snaps.length) throw new Error('no snapshot in the last two weeks')
    const toSnap = (r: (typeof snaps)[number]): Snap => ({ capturedAt: r.capturedAt, metrics: r.metrics as unknown as SnapshotMetrics, checks: r.checks as unknown as CheckResult[] })
    const latest = toSnap(snaps[0])
    const older = snaps.find((r) => latest.capturedAt.getTime() - r.capturedAt.getTime() >= 6.5 * DAY)
    const findings = await prisma.qualityFinding.findMany()
    const mail = buildDigest(latest, older ? toSnap(older) : null, findings, `${getSiteUrl()}/ubaid93`, now)
    await (options.send ?? sendMail)({
      to,
      subject: mail.subject,
      text: mail.text,
      html: `<pre style="font:14px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap">${escapeHtml(mail.text)}</pre>`,
    })
    return true
  } catch (error) {
    // Not sent: give the week back, so the next run tries again.
    await prisma.siteConfig.update({ where: { key: DIGEST_KEY }, data: { value: previous } }).catch(() => undefined)
    console.error('[quality-digest] not sent:', error instanceof Error ? error.message.split('\n')[0] : error)
    return false
  }
}
