// The daily quality snapshot (docs/QUALITY_AGENTS_PLAN.md, layer 1): headline numbers and every check's count over the
// listed jobs, stored as one QualitySnapshot row, and the findings list (QualityFinding) brought up to date. The quality
// agents read it; only this code writes it. Reads the jobs; writes only the two quality tables.
import type { PrismaClient } from '@prisma/client'

import { countReviewQueue } from '../admin/reviewQueue'
import { buildFreshJobWhere } from '../jobs/freshness'
import { buildWhere } from '../jobs/queryJobs'
import { fillRate, runChecks, type CheckResult, type CheckRow } from './checks'

export const SNAPSHOT_VERSION = 1

export type SnapshotMetrics = {
  listedJobs: number
  /** Not expired and posted within the display window: the job pages that answer 200. */
  pagesUp: number
  fill: { role: number; country: number; workMode: number; company: number }
  review: { pay: number; titles: number }
  /** Open pull requests that name a finding ("Quality-Finding: <key>"). */
  agentPrs: Array<{ key: string; url: string; title: string }>
}

export type Snapshot = { capturedAt: Date; version: number; metrics: SnapshotMetrics; checks: CheckResult[] }

/** A pull request as GitHub lists it, reduced to what linking needs. */
export type PrInfo = { url: string; title: string; body: string | null; state: 'open' | 'closed'; merged: boolean }

/** The finding keys a pull request names, one "Quality-Finding: <key>" line each. */
export function findingKeysOf(body: string | null | undefined): string[] {
  return [...(body ?? '').matchAll(/^\s*Quality-Finding:\s*([a-z0-9_]+)\s*$/gim)].map((m) => m[1].toLowerCase())
}

export async function collectSnapshot(db: PrismaClient, prs: PrInfo[] = [], now: Date = new Date()): Promise<Snapshot> {
  const listed = buildWhere({})
  const [rows, pagesUp, review] = await Promise.all([
    db.job.findMany({
      where: listed,
      select: {
        id: true, title: true, source: true, applyUrl: true, salaryMin: true, salaryMax: true, salaryCurrency: true,
        salaryValidated: true, roleSlug: true, countryCode: true, remoteMode: true, companyId: true,
      },
    }) as Promise<CheckRow[]>,
    db.job.count({ where: { isExpired: false, ...buildFreshJobWhere() } }),
    countReviewQueue(),
  ])
  const checks = runChecks(rows)
  checks.push({
    key: 'pay_review_queue',
    area: 'review',
    severity: 'medium',
    title: 'Jobs with pay over $600k a year waiting in the Review queue',
    count: review.pay,
    of: pagesUp,
    sample: [],
  })
  const agentPrs = prs
    .filter((p) => p.state === 'open')
    .flatMap((p) => findingKeysOf(p.body).map((key) => ({ key, url: p.url, title: p.title })))
  return {
    capturedAt: now,
    version: SNAPSHOT_VERSION,
    metrics: {
      listedJobs: rows.length,
      pagesUp,
      fill: { role: fillRate(rows, 'roleSlug'), country: fillRate(rows, 'countryCode'), workMode: fillRate(rows, 'remoteMode'), company: fillRate(rows, 'companyId') },
      review,
      agentPrs,
    },
    checks,
  }
}

export type FindingState = { status: string; prUrl: string | null; note: string | null; fixedAt: Date | null }

/**
 * A finding's next state from today's count and the pull requests that name it:
 *  - "wontfix" stays (the owner decided; reopened by hand on the Quality page);
 *  - an open PR naming it: "pr" with that PR;
 *  - its PR closed without merging: "wontfix", so no agent retries it without new evidence;
 *  - count 0: "fixed";
 *  - otherwise "open" (a merged PR that left the count above zero reopens it, with a note).
 */
export function nextFindingState(prev: FindingState | null, count: number, prs: PrInfo[], key: string, now: Date): FindingState {
  if (prev?.status === 'wontfix') return prev
  const naming = prs.filter((p) => findingKeysOf(p.body).includes(key))
  const open = naming.find((p) => p.state === 'open')
  if (open) return { status: 'pr', prUrl: open.url, note: null, fixedAt: null }
  const own = prev?.prUrl ? naming.find((p) => p.url === prev.prUrl) : undefined
  if (prev?.status === 'pr' && own && own.state === 'closed' && !own.merged) {
    return { status: 'wontfix', prUrl: own.url, note: 'Its pull request was closed without merging.', fixedAt: null }
  }
  if (count === 0) return { status: 'fixed', prUrl: prev?.prUrl ?? null, note: null, fixedAt: prev?.fixedAt ?? now }
  const merged = own?.merged ? `Pull request merged, but ${count} still match.` : null
  return { status: 'open', prUrl: prev?.prUrl ?? null, note: merged, fixedAt: null }
}

/** Stores the snapshot and brings every finding up to date. */
export async function saveSnapshot(db: PrismaClient, snap: Snapshot, prs: PrInfo[]): Promise<{ open: number; fixed: number }> {
  await db.qualitySnapshot.create({
    data: { capturedAt: snap.capturedAt, version: snap.version, metrics: snap.metrics as object, checks: snap.checks as object },
  })
  const existing = new Map((await db.qualityFinding.findMany()).map((f) => [f.key, f]))
  let open = 0
  let fixed = 0
  for (const c of snap.checks) {
    const prev = existing.get(c.key) ?? null
    if (!prev && c.count === 0) continue
    const next = nextFindingState(prev, c.count, prs, c.key, snap.capturedAt)
    if (next.status === 'open' || next.status === 'pr') open++
    if (next.status === 'fixed') fixed++
    const data = {
      area: c.area, title: c.title, severity: c.severity, count: c.count, sample: c.sample as object,
      status: next.status, prUrl: next.prUrl, note: next.note, fixedAt: next.fixedAt,
      ...(c.count > 0 ? { lastSeenAt: snap.capturedAt } : {}),
    }
    if (prev) await db.qualityFinding.update({ where: { key: c.key }, data })
    else await db.qualityFinding.create({ data: { key: c.key, firstSeenAt: snap.capturedAt, lastSeenAt: snap.capturedAt, ...data } })
  }
  return { open, fixed }
}

/** Open pull requests, and ones closed in the last 30 days, from the GitHub API; [] without a token or on failure. */
export async function fetchPrs(repo: string | undefined, token: string | undefined, fetchImpl: typeof fetch = fetch): Promise<PrInfo[]> {
  if (!repo || !token) return []
  const since = Date.now() - 30 * 86_400_000
  const out: PrInfo[] = []
  for (const state of ['open', 'closed'] as const) {
    try {
      const res = await fetchImpl(`https://api.github.com/repos/${repo}/pulls?state=${state}&per_page=100&sort=updated&direction=desc`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'quality-snapshot' },
      })
      if (!res.ok) continue
      const list = (await res.json()) as Array<{ html_url: string; title: string; body: string | null; state: string; merged_at: string | null; closed_at: string | null }>
      for (const p of list) {
        if (state === 'closed' && (!p.closed_at || Date.parse(p.closed_at) < since)) continue
        out.push({ url: p.html_url, title: p.title, body: p.body, state, merged: Boolean(p.merged_at) })
      }
    } catch {
      // A failed read links nothing this time; it must not stop the snapshot.
    }
  }
  return out
}

/** The report a run prints: what the agents and the job summary read. */
export function formatReport(snap: Snapshot, previous: Pick<Snapshot, 'checks'> | null): string {
  const before = new Map((previous?.checks ?? []).map((c) => [c.key, c.count]))
  const m = snap.metrics
  const lines = [
    `Quality snapshot ${snap.capturedAt.toISOString()}`,
    `Listed jobs ${m.listedJobs}, job pages up ${m.pagesUp}. Fill: role ${m.fill.role}%, country ${m.fill.country}%, work mode ${m.fill.workMode}%, company ${m.fill.company}%.`,
    `Review queue: pay ${m.review.pay}, titles ${m.review.titles}. Agent PRs open: ${m.agentPrs.length}.`,
    '',
    '| check | area | severity | count | change | of |',
    '|---|---|---|---|---|---|',
    ...snap.checks.map((c) => {
      const b = before.get(c.key)
      const change = b == null ? 'new' : c.count - b === 0 ? '0' : `${c.count - b > 0 ? '+' : ''}${c.count - b}`
      return `| ${c.key} | ${c.area} | ${c.severity} | ${c.count} | ${change} | ${c.of} |`
    }),
  ]
  for (const c of snap.checks.filter((c) => c.sample.length)) {
    lines.push('', `${c.key} examples:`, ...c.sample.map((s) => `- ${s.id}: ${s.text}`))
  }
  return lines.join('\n')
}
