// The figures and health checks of the admin Overview and System pages. Every query is a read; the slow ones (a scan
// of the job table by source) are on the System page only.
import { CURSOR_KEY } from '../../../lib/scrapers/freehireChanges'
import { prisma } from '../../../lib/prisma'
import { getIndexingPhase } from '../../../lib/seo/indexingPhase'
import { getSitemapWave, SITEMAP_WAVE_COUNT } from '../../../lib/seo/sitemapWaves'
import type { Tone } from './ui'

const HOUR = 3_600_000
const DAY = 24 * HOUR

export type Check = { label: string; tone: Tone; state: string; detail?: string; href?: string }

/** ok under `okH` hours, warn under `warnH`, bad after; muted when never. */
function freshness(at: Date | null | undefined, okH: number, warnH: number, now: number): Tone {
  if (!at) return 'muted'
  const h = (now - at.getTime()) / HOUR
  return h <= okH ? 'ok' : h <= warnH ? 'warn' : 'bad'
}

function since(at: Date, now: number): string {
  const min = Math.round((now - at.getTime()) / 60_000)
  if (min < 60) return `${Math.max(min, 1)} min ago`
  const h = Math.round(min / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}

export async function loadHealthChecks(now: number = Date.now()): Promise<Check[]> {
  const [newest, cursor, indexing, failed7d] = await Promise.all([
    prisma.job.findFirst({ where: { isExpired: false }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, source: true } }),
    prisma.siteConfig.findUnique({ where: { key: CURSOR_KEY }, select: { updatedAt: true } }),
    prisma.jobIndexingQueue.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.jobIndexingQueue.count({ where: { status: 'failed', updatedAt: { gte: new Date(now - 7 * DAY) } } }),
  ])
  const byStatus = Object.fromEntries(indexing.map((r) => [r.status, r._count._all])) as Record<string, number>
  const pending = byStatus.pending ?? 0
  const wave = getSitemapWave()

  return [
    {
      label: 'New jobs arriving',
      tone: freshness(newest?.createdAt, 2, 12, now),
      state: newest ? `Last job added ${since(newest.createdAt, now)}` : 'No live jobs',
      detail: newest ? `from ${newest.source.replace(/^board:/, '')}` : undefined,
      href: '/ubaid93/system',
    },
    {
      label: 'Closed jobs removed',
      // freehire's change feed runs with each sync, about every 5.5 hours (freehire-sync.yml).
      tone: freshness(cursor?.updatedAt, 8, 24, now),
      state: cursor ? `Change feed read ${since(cursor.updatedAt, now)}` : 'Change feed never read',
      detail: 'freehire closings, every sync',
    },
    {
      label: 'Google Indexing queue',
      tone: failed7d > 0 ? 'warn' : pending > 500 ? 'warn' : 'ok',
      state: `${pending.toLocaleString()} waiting · ${failed7d.toLocaleString()} failed in 7 days`,
      detail: `${(byStatus.sent ?? 0).toLocaleString()} sent in all`,
    },
    {
      label: 'Search engines',
      tone: 'muted',
      state: `Indexing phase ${getIndexingPhase()} · sitemap wave ${wave} of ${SITEMAP_WAVE_COUNT}`,
      detail: 'SITEMAP_WAVE in Openship',
    },
  ]
}

export type Daily = { days: string[]; added: number[]; expired: number[]; clicks: number[] }

export async function loadDaily(days: string[]): Promise<Daily> {
  const from = new Date(`${days[0]}T00:00:00Z`)
  const [added, expired, clicks] = await Promise.all([
    prisma.$queryRaw<Array<{ d: string; n: number }>>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM "Job" WHERE "createdAt" >= ${from} GROUP BY 1`,
    // Every expiry path stamps validThrough with the day it expired the job (lib/jobs/expiry.ts).
    prisma.$queryRaw<Array<{ d: string; n: number }>>`
      SELECT to_char(date_trunc('day', "validThrough" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM "Job" WHERE "isExpired" = true AND "validThrough" >= ${from} GROUP BY 1`,
    prisma.$queryRaw<Array<{ d: string; n: number }>>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM "ApplyClick" WHERE "createdAt" >= ${from} GROUP BY 1`.catch(() => []),
  ])
  const fill = (rows: Array<{ d: string; n: number }>) => {
    const m = new Map(rows.map((r) => [r.d, Number(r.n)]))
    return days.map((d) => m.get(d) ?? 0)
  }
  return { days, added: fill(added), expired: fill(expired), clicks: fill(clicks) }
}
