// Expire freehire jobs that freehire itself reports as closed.
//
// History: comparing "what freehire still lists" with "what we have" does not work. freehire pages by offset over
// results with many near-identical `posted_at` values and skips rows between pages, so a production dry run on
// 2026-11-05 flagged 442 jobs and 4 of 6 spot-checked ones were still open. This check instead asks freehire about
// each job individually (`GET /api/v1/jobs/{public_slug}`) and acts only on an explicit `closed_at`.
//
// freehire documents that closed roles are kept and marked closed, never silently deleted, so a 404 is NOT treated as
// closed: it is counted and reported, and nothing is expired because of it.
//
// A single `closed_at` is not enough either: in the first production dry run the one job reported closed was open
// again (and listed in freehire's open search) minutes later. So a job is expired only if freehire says closed AND its
// open search no longer lists the posting; any conflict keeps the job.
//
// Safety: a run is skipped if too many lookups failed, and aborted if it would expire an implausible share.

import axios from 'axios'

import { prisma } from '../prisma'
import { expireJobsByIds } from '../jobs/expiry'
import { makeBoardSource } from '../ingest/sourcePriority'
import { freehireHeaders, type FreehireJob } from './freehire'

const JOB_URL = 'https://freehire.me/api/v1/jobs'
const SEARCH_URL = 'https://freehire.me/api/v1/jobs/search'

export const MAX_ERROR_FRACTION = 0.05
export const MAX_CLOSE_FRACTION = 0.4

export type Lookup = { state: 'open' } | { state: 'closed'; closedAt: string } | { state: 'gone' } | { state: 'error'; message: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One job at freehire. Waits out 429s (Retry-After) a few times; anything else unexpected is an `error`, not a verdict. */
export async function lookupFreehireJob(slug: string): Promise<Lookup> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await axios.get<{ data?: Partial<FreehireJob> }>(`${JOB_URL}/${encodeURIComponent(slug)}`, {
        headers: freehireHeaders(),
        timeout: 30_000,
      })
      const closedAt = res.data?.data?.closed_at
      return closedAt ? { state: 'closed', closedAt } : { state: 'open' }
    } catch (error) {
      const response = (error as { response?: { status?: number; headers?: Record<string, string> } }).response
      if (response?.status === 404) return { state: 'gone' }
      if (response?.status === 429 && attempt < 3) {
        await sleep(Math.min((Number(response.headers?.['retry-after']) || 5) * 1000, 60_000))
        continue
      }
      return { state: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }
  return { state: 'error', message: 'rate limited' }
}

/** Find a job's freehire slug by searching its title and matching the external id. Null when not found. */
export async function resolveFreehireSlug(title: string, externalId: string): Promise<string | null> {
  try {
    const res = await axios.get<{ data?: Array<Pick<FreehireJob, 'public_slug' | 'external_id'>> }>(SEARCH_URL, {
      headers: freehireHeaders(),
      timeout: 30_000,
      params: { q: title, limit: 50 },
    })
    return res.data?.data?.find((j) => j.external_id === externalId)?.public_slug ?? null
  } catch {
    return null
  }
}

export type ActiveJob = { id: string; title: string; externalId: string | null; sourceRef: string | null }

export type ClosedCheckOptions = {
  dryRun?: boolean
  concurrency?: number
  /** Minimum gap between requests per worker, to stay under freehire's rate limit. */
  paceMs?: number
  maxErrorFraction?: number
  maxCloseFraction?: number
  /** Injected in tests. */
  lookup?: (slug: string) => Promise<Lookup>
  resolve?: (title: string, externalId: string) => Promise<string | null>
  saveSlug?: (jobId: string, slug: string) => Promise<void>
  loadActive?: () => Promise<ActiveJob[]>
}

export type ClosedCheckResult = {
  status: 'ok' | 'skipped' | 'aborted'
  reason?: string
  active: number
  resolved: number
  unresolved: number
  checked: number
  open: number
  gone: number
  errors: number
  closed: ActiveJob[]
  /** Reported closed, but freehire's open search still lists the posting, so they are kept. */
  conflicts: ActiveJob[]
  expired: number
}

async function pool<T>(items: T[], concurrency: number, paceMs: number, work: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++]
        await work(item)
        if (paceMs) await sleep(paceMs)
      }
    }),
  )
}

export async function checkClosedFreehireJobs(options: ClosedCheckOptions = {}): Promise<ClosedCheckResult> {
  const lookup = options.lookup ?? lookupFreehireJob
  const resolve = options.resolve ?? resolveFreehireSlug
  const saveSlug =
    options.saveSlug ?? (async (jobId: string, slug: string) => void (await prisma.job.update({ where: { id: jobId }, data: { sourceRef: slug } })))
  const loadActive =
    options.loadActive ??
    (() =>
      prisma.job.findMany({
        where: { source: makeBoardSource('freehire'), isExpired: false },
        select: { id: true, title: true, externalId: true, sourceRef: true },
      }))
  const concurrency = options.concurrency ?? 3
  const paceMs = options.paceMs ?? 350

  const active = await loadActive()
  const slugOf = new Map<string, string>()
  for (const j of active) if (j.sourceRef) slugOf.set(j.id, j.sourceRef)

  // Jobs imported before slugs were stored: find the slug by title search. Storing it is identifier metadata only, so it
  // is done in dry runs too.
  const missing = active.filter((j) => !j.sourceRef && j.externalId)
  let resolved = 0
  await pool(missing, concurrency, paceMs, async (j) => {
    const slug = await resolve(j.title, j.externalId as string)
    if (!slug) return
    slugOf.set(j.id, slug)
    resolved++
    await saveSlug(j.id, slug).catch(() => {})
  })

  const toCheck = active.filter((j) => slugOf.has(j.id))
  const counts = { open: 0, gone: 0, errors: 0 }
  const reportedClosed: ActiveJob[] = []
  await pool(toCheck, concurrency, paceMs, async (j) => {
    const r = await lookup(slugOf.get(j.id) as string)
    if (r.state === 'closed') reportedClosed.push(j)
    else if (r.state === 'open') counts.open++
    else if (r.state === 'gone') counts.gone++
    else counts.errors++
  })

  // Second opinion: freehire's open search must no longer list a posting we are about to expire.
  const closed: ActiveJob[] = []
  const conflicts: ActiveJob[] = []
  await pool(reportedClosed, concurrency, paceMs, async (j) => {
    const stillListed = await resolve(j.title, j.externalId as string)
    if (stillListed) conflicts.push(j)
    else closed.push(j)
  })

  const base = {
    active: active.length,
    resolved,
    unresolved: active.length - toCheck.length,
    checked: toCheck.length,
    ...counts,
    closed,
    conflicts,
    expired: 0,
  }

  const maxErr = options.maxErrorFraction ?? MAX_ERROR_FRACTION
  if (toCheck.length > 0 && counts.errors / toCheck.length > maxErr) {
    return { ...base, status: 'skipped', reason: `${counts.errors} of ${toCheck.length} lookups failed (limit ${Math.round(maxErr * 100)}%)` }
  }
  const maxClose = options.maxCloseFraction ?? MAX_CLOSE_FRACTION
  if (toCheck.length > 0 && closed.length / toCheck.length > maxClose) {
    return {
      ...base,
      status: 'aborted',
      reason: `would expire ${closed.length} of ${toCheck.length} checked jobs (${Math.round((closed.length / toCheck.length) * 100)}%), above the ${Math.round(maxClose * 100)}% safety limit`,
    }
  }

  if (options.dryRun || closed.length === 0) return { ...base, status: 'ok' }
  const { expired } = await expireJobsByIds(closed.map((j) => j.id))
  return { ...base, status: 'ok', expired }
}
