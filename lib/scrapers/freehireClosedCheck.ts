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
//
// The same lookups also keep the site complete (they cost nothing extra, one request per job either way):
//  - A job freehire confirms is open (and still listable, see isListableByReality) gets its `updatedAt` refreshed.
//    The daily sync only re-reads the newest ~36 hours, so without this every job reached the 7-day expiry whether or
//    not it was still open, and company pages only ever showed the last week's jobs.
//  - Jobs imported from freehire's search preview (cut at ~1,000 characters) get their full description.

import axios from 'axios'

import { prisma } from '../prisma'
import { expireJobsByIds } from '../jobs/expiry'
import { isFullerDescription, sanitizeJobDescriptionFields } from '../jobs/descriptionCleaning'
import { makeBoardSource } from '../ingest/sourcePriority'
import { decideRateLimitWait, freehireHeaders, isListableByReality, type FreehireJob } from './freehire'

const JOB_URL = 'https://freehire.me/api/v1/jobs'
const SEARCH_URL = 'https://freehire.me/api/v1/jobs/search'

export const MAX_ERROR_FRACTION = 0.05
export const MAX_CLOSE_FRACTION = 0.4
/**
 * Most jobs looked up per run. Each lookup is one request against the API key's daily quota (10,000 when last seen,
 * 2026-11-05), shared with the syncs. Checking all ~6,000 active jobs every run used the quota up and every later
 * lookup failed (2026-11-11: 4,985 errors, nothing expired). Least recently confirmed first, so every job is still
 * looked at every few days; the 7-day expiry catches anything not confirmed open meanwhile.
 */
export const MAX_LOOKUPS_PER_RUN = 2000

/** `quota`: freehire refused with a long Retry-After, i.e. the key's daily quota is used up; no lookup will work now. */
export type Lookup =
  | { state: 'open'; description?: string | null; reality?: FreehireJob['reality'] }
  | { state: 'closed'; closedAt: string }
  | { state: 'gone' }
  | { state: 'error'; message: string; quota?: boolean }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One job at freehire. Waits out 429s (Retry-After) a few times; anything else unexpected is an `error`, not a verdict. */
export async function lookupFreehireJob(slug: string): Promise<Lookup> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await axios.get<{ data?: Partial<FreehireJob> }>(`${JOB_URL}/${encodeURIComponent(slug)}`, {
        headers: freehireHeaders(),
        timeout: 30_000,
      })
      const data = res.data?.data
      const closedAt = data?.closed_at
      return closedAt ? { state: 'closed', closedAt } : { state: 'open', description: data?.description ?? null, reality: data?.reality ?? null }
    } catch (error) {
      const response = (error as { response?: { status?: number; headers?: Record<string, string> } }).response
      if (response?.status === 404) return { state: 'gone' }
      if (response?.status === 429) {
        const h = response.headers ?? {}
        const decision = decideRateLimitWait(h['retry-after'])
        // A long Retry-After means the quota is used up: report an error now instead of waiting hours per lookup.
        if (decision.action === 'give-up') {
          return {
            state: 'error',
            quota: true,
            message: `rate limited for ${decision.seconds}s (limit=${h['x-ratelimit-limit'] ?? '-'} remaining=${h['x-ratelimit-remaining'] ?? '-'} reset=${h['x-ratelimit-reset'] ?? '-'})`,
          }
        }
        if (attempt < 3) {
          await sleep(decision.seconds * 1000)
          continue
        }
      }
      const message = error instanceof Error ? error.message : String(error)
      return { state: 'error', message: response?.status ? `HTTP ${response.status}: ${message}` : message }
    }
  }
  return { state: 'error', message: 'rate limited' }
}

/** Search freehire for a job by title; its slug when a result has the external id, null when none does. Throws on failure. */
async function searchFreehireSlug(title: string, externalId: string): Promise<string | null> {
  const res = await axios.get<{ data?: Array<Pick<FreehireJob, 'public_slug' | 'external_id'>> }>(SEARCH_URL, {
    headers: freehireHeaders(),
    timeout: 30_000,
    params: { q: title, limit: 50 },
  })
  return res.data?.data?.find((j) => j.external_id === externalId)?.public_slug ?? null
}

/** Find a job's freehire slug by searching its title and matching the external id. Null when not found or on failure. */
export async function resolveFreehireSlug(title: string, externalId: string): Promise<string | null> {
  return searchFreehireSlug(title, externalId).catch(() => null)
}

/**
 * Whether freehire's open search still lists a posting: true, false, or null when the search failed. A failure must
 * never count as "no longer listed": that would expire an open job (for instance once the quota is used up).
 */
export async function isStillListed(title: string, externalId: string): Promise<boolean | null> {
  try {
    return (await searchFreehireSlug(title, externalId)) !== null
  } catch {
    return null
  }
}

export type ActiveJob = {
  id: string
  title: string
  externalId: string | null
  sourceRef: string | null
  descriptionHtml?: string | null
  /** Last refresh (sync or a confirmed-open check): the least recently refreshed are looked up first. */
  updatedAt?: Date | null
}

export type ClosedCheckOptions = {
  dryRun?: boolean
  concurrency?: number
  /** Minimum gap between requests per worker, to stay under freehire's rate limit. */
  paceMs?: number
  maxErrorFraction?: number
  maxCloseFraction?: number
  /** Total time the check may take. When exceeded it stops and expires NOTHING (status `skipped`). */
  deadlineMs?: number
  /** Most jobs to look up this run, least recently refreshed first (default MAX_LOOKUPS_PER_RUN). */
  maxLookups?: number
  /** Progress lines (phase and counts), so a stalled run is visible in the log. */
  onProgress?: (message: string) => void
  /** Injected in tests. */
  lookup?: (slug: string) => Promise<Lookup>
  resolve?: (title: string, externalId: string) => Promise<string | null>
  /** Second opinion before expiring: true/false, or null when unknown (kept). Defaults to isStillListed, or, when only
   *  `resolve` is injected (tests), to whether it finds a slug. */
  stillListed?: (title: string, externalId: string) => Promise<boolean | null>
  saveSlug?: (jobId: string, slug: string) => Promise<void>
  /** Writes the outcome for jobs freehire confirmed open: refresh these, replace these descriptions. Injected in tests. */
  applyRefresh?: (refresh: { keepAliveIds: string[]; descriptions: Array<{ id: string; html: string }> }) => Promise<void>
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
  /** Open jobs whose `updatedAt` was refreshed so the 7-day expiry leaves them alone. */
  refreshed: number
  /** Jobs whose truncated description was replaced with the full one. */
  descriptionsUpgraded: number
  expired: number
}

/** The cleaned full description when it is a clear upgrade over what is stored, else null. */
export function upgradedDescription(stored: string | null | undefined, fetched: string | null | undefined): string | null {
  if (!fetched) return null
  const clean = sanitizeJobDescriptionFields(fetched, null)
  if (clean.polluted || !clean.descriptionHtml) return null
  return isFullerDescription(stored, clean.descriptionHtml) ? clean.descriptionHtml : null
}

async function applyRefreshToDatabase({ keepAliveIds, descriptions }: { keepAliveIds: string[]; descriptions: Array<{ id: string; html: string }> }) {
  const now = new Date()
  for (let i = 0; i < keepAliveIds.length; i += 500) {
    await prisma.job.updateMany({
      where: { id: { in: keepAliveIds.slice(i, i + 500) }, isExpired: false },
      data: { lastSeenAt: now, updatedAt: now },
    })
  }
  for (const { id, html } of descriptions) {
    await prisma.job.update({ where: { id }, data: { descriptionHtml: html } })
  }
}

async function pool<T>(
  items: T[],
  concurrency: number,
  paceMs: number,
  work: (item: T) => Promise<void>,
  opts: { stop?: () => boolean; onProgress?: (done: number, total: number) => void } = {},
) {
  let next = 0
  let done = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length && !opts.stop?.()) {
        const item = items[next++]
        await work(item)
        done++
        if (opts.onProgress && done % 250 === 0) opts.onProgress(done, items.length)
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
        select: { id: true, title: true, externalId: true, sourceRef: true, descriptionHtml: true, updatedAt: true },
      }))
  const applyRefresh = options.applyRefresh ?? applyRefreshToDatabase
  const stillListed =
    options.stillListed ??
    (options.resolve ? async (t: string, e: string) => (await resolve(t, e)) !== null : isStillListed)
  const maxLookups = options.maxLookups ?? MAX_LOOKUPS_PER_RUN
  const concurrency = options.concurrency ?? 3
  const paceMs = options.paceMs ?? 350
  const started = Date.now()
  const deadline = options.deadlineMs ? started + options.deadlineMs : Number.POSITIVE_INFINITY
  const timedOut = () => Date.now() > deadline
  // Set by the first lookup refused for the daily quota: every request after it would fail too, so stop asking.
  let quotaMessage: string | null = null
  const stopped = () => timedOut() || quotaMessage !== null
  const say = (message: string) => options.onProgress?.(`[${Math.round((Date.now() - started) / 1000)}s] ${message}`)

  const active = await loadActive()
  say(`loaded ${active.length} active freehire jobs`)
  const slugOf = new Map<string, string>()
  for (const j of active) if (j.sourceRef) slugOf.set(j.id, j.sourceRef)

  // Jobs imported before slugs were stored: find the slug by title search. Storing it is identifier metadata only, so it
  // is done in dry runs too.
  const missing = active.filter((j) => !j.sourceRef && j.externalId)
  let resolved = 0
  say(`finding slugs for ${missing.length} older jobs`)
  await pool(
    missing,
    concurrency,
    paceMs,
    async (j) => {
      const slug = await resolve(j.title, j.externalId as string)
      if (!slug) return
      slugOf.set(j.id, slug)
      resolved++
      await saveSlug(j.id, slug).catch(() => {})
    },
    { stop: timedOut },
  )

  // Least recently refreshed first (no date first), at most maxLookups of them.
  const identifiable = active.filter((j) => slugOf.has(j.id))
  const toCheck = [...identifiable]
    .sort((a, b) => (a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0))
    .slice(0, maxLookups)
  if (toCheck.length < identifiable.length) say(`checking the ${toCheck.length} least recently refreshed of ${identifiable.length}`)
  const counts = { open: 0, gone: 0, errors: 0 }
  const errorSamples = new Set<string>()
  const reportedClosed: ActiveJob[] = []
  const keepAliveIds: string[] = []
  const descriptions: Array<{ id: string; html: string }> = []
  say(`checking ${toCheck.length} jobs`)
  await pool(
    toCheck,
    concurrency,
    paceMs,
    async (j) => {
      const r = await lookup(slugOf.get(j.id) as string)
      if (r.state === 'closed') reportedClosed.push({ ...j, sourceRef: slugOf.get(j.id) ?? null })
      else if (r.state === 'open') {
        counts.open++
        if (isListableByReality(r.reality)) keepAliveIds.push(j.id)
        const html = upgradedDescription(j.descriptionHtml, r.description)
        if (html) descriptions.push({ id: j.id, html })
      } else if (r.state === 'gone') counts.gone++
      else {
        counts.errors++
        if (r.quota && quotaMessage === null) quotaMessage = r.message
        if (errorSamples.size < 3 && !errorSamples.has(r.message)) {
          errorSamples.add(r.message)
          say(`lookup error: ${r.message}`)
        }
      }
    },
    {
      stop: stopped,
      onProgress: (done, total) => say(`checked ${done}/${total} (open ${counts.open}, errors ${counts.errors}, reported closed ${reportedClosed.length})`),
    },
  )

  // Second opinion: freehire's open search must no longer list a posting we are about to expire. A failed search is
  // "unknown" and keeps the job.
  const closed: ActiveJob[] = []
  const conflicts: ActiveJob[] = []
  await pool(
    reportedClosed,
    concurrency,
    paceMs,
    async (j) => {
      const listed = await stillListed(j.title, j.externalId as string)
      if (listed === false) closed.push(j)
      else if (listed === true) conflicts.push(j)
      else counts.errors++
    },
    { stop: stopped },
  )

  // Confirmed-open jobs are refreshed even when the run is later skipped or aborted: that says nothing about them.
  // A dry run reports only.
  if (!options.dryRun) await applyRefresh({ keepAliveIds, descriptions })
  say(`${options.dryRun ? 'would refresh' : 'refreshed'} ${keepAliveIds.length} open jobs, ${descriptions.length} descriptions upgraded`)

  const base = {
    refreshed: options.dryRun ? 0 : keepAliveIds.length,
    descriptionsUpgraded: options.dryRun ? 0 : descriptions.length,
    active: active.length,
    resolved,
    unresolved: active.length - toCheck.length,
    checked: toCheck.length,
    ...counts,
    closed,
    conflicts,
    expired: 0,
  }

  say(`done: open ${counts.open}, gone ${counts.gone}, errors ${counts.errors}, confirmed closed ${closed.length}`)
  // The quota ran out: what was not looked at is unknown, so nothing is expired. The next run starts again.
  if (quotaMessage !== null) {
    return { ...base, status: 'skipped', reason: `freehire's daily quota is used up (${quotaMessage}); nothing was expired` }
  }
  // Out of time: whatever was not looked at is unknown, so nothing is expired. The next run starts again.
  if (timedOut()) {
    return { ...base, status: 'skipped', reason: `time budget of ${Math.round((options.deadlineMs ?? 0) / 60000)} minutes exceeded; nothing was expired` }
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
