// Health checks of the site's data pipeline, shared by the admin console (Overview, System) and the alert emails
// (lib/admin/healthAlerts.ts). Loading reads a handful of small queries; evaluating is pure, so the rules are tested.
import { errorGroupKey, isNoiseError } from './errorReports'
import { since } from './timeAgo'
import { prisma } from '../prisma'
import { CURSOR_KEY } from '../scrapers/freehireChanges'
import { getIndexingPhase } from '../seo/indexingPhase'
import { getSitemapWave, SITEMAP_WAVE_ADDS, SITEMAP_WAVE_COUNT } from '../seo/sitemapWaves'

export type Tone = 'ok' | 'warn' | 'bad' | 'muted'
/** `database` is raised only by the alert run (lib/admin/healthAlerts.ts), when the facts cannot be read at all. */
export type CheckKey = 'live' | 'arrivals' | 'closings' | 'indexing' | 'errors' | 'search' | 'database'
export type Check = {
  key: CheckKey
  label: string
  tone: Tone
  state: string
  detail?: string
  href?: string
  /** How the problem reads in the Overview's "Needs a look" list, when it is red. */
  todo?: string
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

/**
 * Thresholds. `bad` is what emails the owner, so each is a state that needs a person:
 * - fewer than 1,000 live jobs: the site is on the wrong or an empty database (two outages on 2026-11-13 answered 200
 *   with 0 jobs), or the expiry went wrong;
 * - no new job for 12 hours: the 5-minute freehire pull and the scheduled syncs have all stopped;
 * - freehire's change feed not read for 24 hours: closed jobs stay listed (the sync runs about every 5.5 hours);
 * - 20 failed Google Indexing notices in 24 hours: the key or quota is broken;
 * - 100 reports of one browser error in an hour: something is broken for many visitors (the error endpoint keeps at
 *   most 100 an hour per error, so this is that cap reached).
 */
export const HEALTH_LIMITS = {
  minLiveJobs: 1000,
  arrivalsOkHours: 2,
  arrivalsBadHours: 12,
  closingsOkHours: 8,
  closingsBadHours: 24,
  indexingFailedBad24h: 20,
  indexingPendingWarn: 500,
  errorBurstBad1h: 100,
  errorBurstWarn1h: 20,
} as const

export type HealthFacts = {
  liveJobs: number
  newestJob: { createdAt: Date; source: string } | null
  closingsReadAt: Date | null
  indexing: Record<string, number>
  indexingFailed24h: number
  indexingFailed7d: number
  /** The browser error reported most often in the last hour (known noise left out). */
  errorBurst: { message: string; count: number } | null
  wave: number
  phase: number | string
}

export async function loadHealthFacts(now: number = Date.now()): Promise<HealthFacts> {
  const [liveJobs, newestJob, cursor, indexing, failed24h, failed7d, recentErrors] = await Promise.all([
    prisma.job.count({ where: { isExpired: false } }),
    prisma.job.findFirst({ where: { isExpired: false }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, source: true } }),
    prisma.siteConfig.findUnique({ where: { key: CURSOR_KEY }, select: { updatedAt: true } }),
    prisma.jobIndexingQueue.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.jobIndexingQueue.count({ where: { status: 'failed', updatedAt: { gte: new Date(now - DAY) } } }),
    prisma.jobIndexingQueue.count({ where: { status: 'failed', updatedAt: { gte: new Date(now - 7 * DAY) } } }),
    prisma.errorLog
      .findMany({
        where: { createdAt: { gte: new Date(now - HOUR) } },
        select: { message: true },
        take: 5000,
      })
      .catch(() => [] as Array<{ message: string }>),
  ])
  const burst = new Map<string, { message: string; count: number }>()
  for (const r of recentErrors) {
    if (isNoiseError(r.message)) continue
    const key = errorGroupKey(r.message)
    const g = burst.get(key) ?? { message: r.message, count: 0 }
    g.count++
    burst.set(key, g)
  }
  return {
    liveJobs,
    newestJob,
    closingsReadAt: cursor?.updatedAt ?? null,
    indexing: Object.fromEntries(indexing.map((r) => [r.status, r._count._all])),
    indexingFailed24h: failed24h,
    indexingFailed7d: failed7d,
    errorBurst: [...burst.values()].sort((a, b) => b.count - a.count)[0] ?? null,
    wave: getSitemapWave(),
    phase: getIndexingPhase(),
  }
}

/** ok up to `okH` hours old, warn up to `badH`, bad after; bad when it never happened. */
function freshness(at: Date | null | undefined, okH: number, badH: number, now: number): Tone {
  if (!at) return 'bad'
  const h = (now - at.getTime()) / HOUR
  return h <= okH ? 'ok' : h <= badH ? 'warn' : 'bad'
}

export function evaluateHealth(f: HealthFacts, now: number = Date.now()): Check[] {
  const L = HEALTH_LIMITS
  const pending = f.indexing.pending ?? 0
  const burst = f.errorBurst
  return [
    {
      key: 'live',
      label: 'Jobs not expired',
      tone: f.liveJobs < L.minLiveJobs ? 'bad' : 'ok',
      state: `${f.liveJobs.toLocaleString('en-US')}`,
      detail: f.liveJobs < L.minLiveJobs ? 'Fewer than expected: is the site on the right database?' : undefined,
      todo: `Only ${f.liveJobs.toLocaleString('en-US')} jobs not expired: is the site on the right database?`,
    },
    {
      key: 'arrivals',
      label: 'New jobs arriving',
      tone: freshness(f.newestJob?.createdAt, L.arrivalsOkHours, L.arrivalsBadHours, now),
      state: f.newestJob ? `Last job added ${since(f.newestJob.createdAt, now)}` : 'No live jobs',
      detail: f.newestJob ? `from ${f.newestJob.source.replace(/^board:/, '')}` : undefined,
      href: '/ubaid93/system',
    },
    {
      key: 'closings',
      label: 'Closed jobs removed',
      tone: freshness(f.closingsReadAt, L.closingsOkHours, L.closingsBadHours, now),
      state: f.closingsReadAt ? `freehire's list of closed jobs read ${since(f.closingsReadAt, now)}` : "freehire's list of closed jobs never read",
      detail: 'freehire closings, every sync',
    },
    {
      key: 'indexing',
      label: 'Google Indexing queue',
      tone:
        f.indexingFailed24h >= L.indexingFailedBad24h
          ? 'bad'
          : f.indexingFailed7d > 0 || pending > L.indexingPendingWarn
            ? 'warn'
            : 'ok',
      state: `${pending.toLocaleString('en-US')} waiting · ${f.indexingFailed24h.toLocaleString('en-US')} failed in 24 h`,
      detail: `${f.indexingFailed7d.toLocaleString('en-US')} failed in 7 days`,
    },
    {
      key: 'errors',
      label: 'Browser errors',
      tone: !burst ? 'ok' : burst.count >= L.errorBurstBad1h ? 'bad' : burst.count >= L.errorBurstWarn1h ? 'warn' : 'ok',
      state: burst ? `${burst.count.toLocaleString('en-US')} reports of one error in the last hour` : 'None in the last hour',
      detail: burst && burst.count >= L.errorBurstWarn1h ? burst.message.slice(0, 120) : undefined,
      href: '/ubaid93/errors',
    },
    {
      key: 'search',
      label: 'Search engines',
      tone: 'muted',
      // The wave is what the sitemap submits now (SITEMAP_WAVE); the phase decides whether job pages are submitted
      // (INDEXING_PHASE; from 2, sitemap-jobs.xml).
      state: `Sitemap wave ${f.wave} of ${SITEMAP_WAVE_COUNT}`,
      detail: [
        `Live: up to ${SITEMAP_WAVE_ADDS[f.wave]}.`,
        f.wave < SITEMAP_WAVE_COUNT
          ? `Next: ${SITEMAP_WAVE_ADDS[f.wave + 1]}, once Search Console shows most of wave ${f.wave} indexed (SITEMAP_WAVE in Openship).`
          : '',
        Number(f.phase) >= 2 ? `Job pages submitted (phase ${f.phase}).` : 'Job pages not submitted yet (phase 1).',
      ]
        .filter(Boolean)
        .join(' '),
    },
  ]
}

export { since }

export async function loadHealthChecks(now: number = Date.now()): Promise<Check[]> {
  return evaluateHealth(await loadHealthFacts(now), now)
}
