// lib/scrapers/freehireRecent.ts
//
// The newest freehire jobs whose pay clears our thresholds, saved within minutes of freehire listing them, so the
// homepage live feed and the listings move during the day (owner's request, 2026-11-19: a feed that updates live like
// freehire's "Just added"; the regular syncs ran about every 5.5 hours). Run every 5 minutes by the app itself
// (instrumentation.ts; every 15 until the owner asked for a list that moves more continuously, 2026-11-19) and on demand
// through GET /api/cron/freehire-recent.
//
// Frugal with freehire's daily quota (10,000 requests on the key, 2026-11-08): one page of the newest jobs per currency
// market (about 10 requests a run, about 2,900 a day every 5 minutes; without FREEHIRE_API_KEY in the app these use
// freehire's public access, 300 requests a minute), no "pay in description" pass (about 200 pages a run)
// and no company-website lookups; the regular syncs read the same jobs again and fill those in. It reads jobs posted in
// the last 2 hours, so a late or missed run loses nothing. It goes through the normal ingest (dedupe, salary gate, source
// priority). One run at a time per server: a call while one runs does nothing.
import { collectFreehireJobs, ingestFreehireJobs } from './freehire'

const WINDOW_MS = 2 * 60 * 60 * 1000

export type FreehireRecentResult =
  | { skipped: 'previous run still going' }
  | { ok: boolean; fetched: number; mappable: number; created: number; updated: number; skipped: number; errors: unknown[]; seconds: number }

let running = false

export async function runFreehireRecent(): Promise<FreehireRecentResult> {
  if (running) return { skipped: 'previous run still going' }
  running = true
  const started = Date.now()
  try {
    const collected = await collectFreehireJobs({
      since: new Date(started - WINDOW_MS),
      maxPagesPerMarket: 1,
      withDescriptionPay: false,
    })
    const stats = await ingestFreehireJobs(collected.inputs, { lookUpWebsites: false })
    const result = {
      ok: collected.errors.length === 0,
      fetched: collected.markets.reduce((n, m) => n + m.fetched, 0),
      mappable: collected.inputs.length,
      created: stats.created,
      updated: stats.updated,
      skipped: stats.skipped + collected.unmappable,
      errors: collected.errors,
      seconds: Math.round((Date.now() - started) / 1000),
    }
    console.log('[freehire-recent]', JSON.stringify(result))
    return result
  } finally {
    running = false
  }
}

/** Minutes between the app's own runs: FREEHIRE_RECENT_EVERY_MIN (default 5, at least 5); 0 turns them off. */
export function freehireRecentEveryMs(env: Record<string, string | undefined> = process.env): number | null {
  const raw = env.FREEHIRE_RECENT_EVERY_MIN?.trim()
  if (raw === '0') return null
  const minutes = raw ? Number(raw) : 5
  if (!Number.isFinite(minutes) || minutes <= 0) return 5 * 60_000
  return Math.max(5, minutes) * 60_000
}
