// lib/scrapers/freehireChanges.ts
//
// Delists freehire jobs from freehire's change feed (owner's choice, 2026-11-22: "Change feed for closings").
// `GET /api/v1/jobs/changes` lists every opening, closing and reopening of a public posting, oldest first, 100 a page,
// walked with a cursor that never expires (freehire.me/docs/api, "Keeping a mirror in sync"). Reading it from where the
// last run stopped catches every closing among our freehire jobs, where the per-job check
// (lib/scrapers/freehireClosedCheck.ts) looks at 10,000 of them a run. Measured 2026-11-22: about 25,700 changes an hour
// (about 616,000 a day), 0.33 s a page, so a sync run every 5.5 hours reads about 1,400 pages in about 9 minutes. The
// feed carries no `offset`, so freehire's per-IP 2-a-second offset limit does not apply; one request at a time stays far
// under the plan's 1,200 a minute.
//
// A closing is acted on with the same care as the per-job check: the latest change per posting wins (a posting closed
// and reopened in the same stretch stays), and a job is expired only if freehire's open search no longer lists it either
// (in the first production dry run of the per-job check, a job reported closed was open again minutes later). A failed
// search is "unknown" and keeps the job.
//
// The cursor is stored in SiteConfig and saved only after the closings it covers were applied, so a run that fails, is
// aborted by the safety limit or is a dry run leaves it where it was and the next run reads the same changes again.
// Openings are not applied here: the syncs list new jobs through the normal ingest (salary gate, dedupe).

import axios from 'axios'

import { prisma } from '../prisma'
import { expireJobsByIds } from '../jobs/expiry'
import { makeBoardSource } from '../ingest/sourcePriority'
import { decideRateLimitWait, freehireHeaders } from './freehire'
import { isStillListed } from './freehireClosedCheck'

const CHANGES_URL = 'https://freehire.me/api/v1/jobs/changes'
/** SiteConfig key holding the feed position after the last applied run. */
export const CURSOR_KEY = 'freehire.changes.cursor'
/** With no stored cursor (the first run), start this far back. The per-job check covers anything older. */
export const FIRST_RUN_LOOKBACK_HOURS = 24
/**
 * Most pages one run reads; the rest waits for the next run, from the saved cursor. Was 3,000 until the first live run
 * (2026-11-23 11:36 UTC): a weekday carries about 45,000 changes an hour (25,700 on the Sunday it was measured), so 3,000
 * pages ended about 4 hours behind. Pages came at 0.13 s each, so 8,000 take about 17 minutes, within the script's
 * 20-minute read deadline, and cover about 18 hours of weekday changes against a 5.5-hour gap between runs.
 */
export const MAX_PAGES_PER_RUN = 8000
/** Abort, expiring nothing, if the closings would take more than this share of our active freehire jobs. */
export const MAX_CLOSE_FRACTION = 0.2
/** Skip, expiring nothing, if more than this share of the "still listed?" searches fail. */
export const MAX_ERROR_FRACTION = 0.05

export type FeedChange = {
  public_slug: string
  seq: number
  kind: 'opened' | 'closed' | 'reopened' | string
  at: string
  closed_reason?: string | null
}

export type FeedPage = {
  data: FeedChange[]
  meta: { has_more: boolean; next_cursor?: string | null }
}

export type OurJob = { id: string; title: string; externalId: string | null; sourceRef: string | null }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One feed page. Waits out short 429s and retries dropped connections a few times; anything else throws. */
export async function fetchChangesPage(position: { cursor?: string; since?: string }): Promise<FeedPage> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await axios.get<FeedPage>(CHANGES_URL, {
        headers: freehireHeaders(),
        timeout: 30_000,
        params: position.cursor ? { cursor: position.cursor, limit: 100 } : { since: position.since, limit: 100 },
      })
      return res.data
    } catch (error) {
      const response = (error as { response?: { status?: number; headers?: Record<string, string> } }).response
      if (response?.status === 429 && attempt < 4) {
        const decision = decideRateLimitWait(response.headers?.['retry-after'])
        if (decision.action === 'wait') {
          await sleep(decision.seconds * 1000)
          continue
        }
      }
      if (!response && attempt < 3) {
        await sleep(5_000 * (attempt + 1))
        continue
      }
      throw error
    }
  }
}

/** The latest change (highest `seq`) per posting (pure). */
export function latestBySlug(changes: FeedChange[]): Map<string, FeedChange> {
  const latest = new Map<string, FeedChange>()
  for (const c of changes) {
    const prev = latest.get(c.public_slug)
    if (!prev || c.seq > prev.seq) latest.set(c.public_slug, c)
  }
  return latest
}

export type ChangesResult = {
  status: 'ok' | 'skipped' | 'aborted'
  reason?: string
  pages: number
  changes: number
  /** Postings whose latest change in what was read is a closing. */
  closedInFeed: number
  /** Of those, our active freehire jobs. */
  ours: number
  closed: OurJob[]
  /** Closed in the feed but still listed in freehire's open search: kept. */
  conflicts: OurJob[]
  errors: number
  expired: number
  /** True when the feed was read to its end (nothing left for the next run but new changes). */
  caughtUp: boolean
  cursorSaved: boolean
}

export type ChangesOptions = {
  dryRun?: boolean
  maxPages?: number
  /** Stop reading the feed after this long (what was read is still applied). */
  readDeadlineMs?: number
  now?: () => number
  onProgress?: (message: string) => void
  /** Injected in tests. */
  fetchPage?: (position: { cursor?: string; since?: string }) => Promise<FeedPage>
  loadCursor?: () => Promise<string | null>
  saveCursor?: (cursor: string) => Promise<void>
  findActiveBySlugs?: (slugs: string[]) => Promise<OurJob[]>
  countActive?: () => Promise<number>
  stillListed?: (title: string, externalId: string) => Promise<boolean | null>
  expire?: (ids: string[]) => Promise<{ expired: number }>
}

const FREEHIRE = makeBoardSource('freehire')

/**
 * Our active freehire jobs among these postings. One query for all our active freehire jobs (about 21,000 rows), matched
 * in memory: the closings in one run run to hundreds of thousands (236,399 on 2026-11-23), and asking the database 1,000
 * slugs at a time took 190 s for those, which would not fit the step's time limit at 8,000 pages.
 */
export async function findActiveFreehireJobsBySlugs(slugs: string[]): Promise<OurJob[]> {
  if (slugs.length === 0) return []
  const wanted = new Set(slugs)
  const active = await prisma.job.findMany({
    where: { source: FREEHIRE, isExpired: false, sourceRef: { not: null } },
    select: { id: true, title: true, externalId: true, sourceRef: true },
  })
  return active.filter((j) => j.sourceRef !== null && wanted.has(j.sourceRef))
}

export async function syncFreehireChanges(options: ChangesOptions = {}): Promise<ChangesResult> {
  const now = options.now ?? Date.now
  const fetchPage = options.fetchPage ?? fetchChangesPage
  const loadCursor =
    options.loadCursor ?? (async () => (await prisma.siteConfig.findUnique({ where: { key: CURSOR_KEY } }))?.value ?? null)
  const saveCursor =
    options.saveCursor ??
    (async (value: string) => {
      await prisma.siteConfig.upsert({
        where: { key: CURSOR_KEY },
        create: { key: CURSOR_KEY, value, label: 'freehire change feed position (lib/scrapers/freehireChanges.ts)' },
        update: { value },
      })
    })
  const findActiveBySlugs = options.findActiveBySlugs ?? findActiveFreehireJobsBySlugs
  const countActive = options.countActive ?? (() => prisma.job.count({ where: { source: FREEHIRE, isExpired: false } }))
  const stillListed = options.stillListed ?? isStillListed
  const expire = options.expire ?? expireJobsByIds
  const maxPages = options.maxPages ?? MAX_PAGES_PER_RUN
  const started = now()
  const say = (m: string) => options.onProgress?.(`[${Math.round((now() - started) / 1000)}s] ${m}`)

  // 1. Read the feed from the stored position (or the last day, on the first run).
  const stored = await loadCursor()
  let position: { cursor?: string; since?: string } = stored
    ? { cursor: stored }
    : { since: new Date(now() - FIRST_RUN_LOOKBACK_HOURS * 3_600_000).toISOString() }
  say(stored ? 'reading the change feed from the stored cursor' : `no stored cursor: reading the last ${FIRST_RUN_LOOKBACK_HOURS} hours`)
  const changes: FeedChange[] = []
  let pages = 0
  let lastCursor: string | null = stored
  let caughtUp = false
  let readError: string | null = null
  while (pages < maxPages) {
    if (options.readDeadlineMs && now() - started > options.readDeadlineMs) break
    let page: FeedPage
    try {
      page = await fetchPage(position)
    } catch (error) {
      // Keep what was read: lastCursor still points just past it.
      readError = error instanceof Error ? error.message : String(error)
      say(`feed read failed after ${pages} pages: ${readError}`)
      break
    }
    pages++
    changes.push(...page.data)
    if (page.meta.next_cursor) {
      lastCursor = page.meta.next_cursor
      position = { cursor: page.meta.next_cursor }
    }
    if (pages % 200 === 0) say(`read ${pages} pages (${changes.length} changes, newest ${page.data.at(-1)?.at ?? '-'})`)
    if (!page.meta.has_more) {
      caughtUp = true
      break
    }
  }
  say(`read ${pages} pages, ${changes.length} changes${caughtUp ? ', caught up' : ''}`)

  const base = { pages, changes: changes.length, caughtUp }
  if (pages === 0) {
    return { ...base, status: 'skipped', reason: readError ?? 'nothing read', closedInFeed: 0, ours: 0, closed: [], conflicts: [], errors: 0, expired: 0, cursorSaved: false }
  }

  // 2. Our active jobs whose posting's latest change is a closing.
  const closedSlugs = [...latestBySlug(changes).values()].filter((c) => c.kind === 'closed').map((c) => c.public_slug)
  const ours = closedSlugs.length ? await findActiveBySlugs(closedSlugs) : []
  say(`${closedSlugs.length} postings closed in the feed, ${ours.length} of them ours`)

  // 3. Second opinion: freehire's open search must no longer list the posting. A failed search keeps the job.
  const closed: OurJob[] = []
  const conflicts: OurJob[] = []
  let errors = 0
  for (const job of ours) {
    const listed = job.externalId ? await stillListed(job.title, job.externalId) : null
    if (listed === false) closed.push(job)
    else if (listed === true) conflicts.push(job)
    else errors++
  }
  const counts = { ...base, closedInFeed: closedSlugs.length, ours: ours.length, closed, conflicts, errors }
  say(`confirmed closed ${closed.length}, still listed (kept) ${conflicts.length}, unknown ${errors}`)

  // 4. Safety limits: expire nothing and keep the cursor, so the next run reads these changes again.
  if (ours.length > 0 && errors / ours.length > MAX_ERROR_FRACTION) {
    return { ...counts, status: 'skipped', reason: `${errors} of ${ours.length} searches failed (limit ${MAX_ERROR_FRACTION * 100}%)`, expired: 0, cursorSaved: false }
  }
  const active = closed.length ? await countActive() : 0
  if (closed.length > 0 && closed.length > active * MAX_CLOSE_FRACTION) {
    return {
      ...counts,
      status: 'aborted',
      reason: `would expire ${closed.length} of ${active} active freehire jobs, above the ${MAX_CLOSE_FRACTION * 100}% safety limit`,
      expired: 0,
      cursorSaved: false,
    }
  }
  if (options.dryRun) return { ...counts, status: 'ok', expired: 0, cursorSaved: false }

  // 5. Apply, then move the cursor past what was applied.
  const { expired } = closed.length ? await expire(closed.map((j) => j.id)) : { expired: 0 }
  if (lastCursor && lastCursor !== stored) await saveCursor(lastCursor)
  return {
    ...counts,
    status: 'ok',
    reason: readError ? `feed read stopped early (${readError}); applied what was read` : undefined,
    expired,
    cursorSaved: Boolean(lastCursor && lastCursor !== stored),
  }
}
