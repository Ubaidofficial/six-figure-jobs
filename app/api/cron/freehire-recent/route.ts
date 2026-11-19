// GET /api/cron/freehire-recent — the newest freehire jobs whose pay clears our thresholds, saved within minutes of
// freehire listing them, so the homepage live feed and the listings move during the day (owner's request, 2026-11-19:
// a feed that updates live like freehire's "Just added"; the regular syncs ran about every 5.5 hours). Point a scheduler at
// it every 15 minutes with `Authorization: Bearer <CRON_SECRET>`, like the other /api/cron routes.
//
// Frugal with freehire's daily quota (10,000 requests on the key, 2026-11-08): one page of the newest jobs per currency
// market (about 10 requests a run, about 960 a day every 15 minutes), no "pay in description" pass (about 50 pages a day)
// and no company-website lookups; the regular syncs read the same jobs again and fill those in. It reads jobs posted in
// the last 2 hours, so a late or missed run loses nothing. It runs inside the app, next to the database, through the
// normal ingest (dedupe, salary gate, source priority). 401 without the secret; a second call while one runs does nothing.
import { NextResponse } from 'next/server'

import { collectFreehireJobs, ingestFreehireJobs } from '@/lib/scrapers/freehire'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const WINDOW_MS = 2 * 60 * 60 * 1000

let running = false

function authorized(req: Request): boolean {
  const auth = req.headers.get('authorization')
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRET_NEXT].filter(Boolean)
  return Boolean(auth) && secrets.some((s) => auth === `Bearer ${s}`)
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  if (running) return NextResponse.json({ ok: true, skipped: 'previous run still going' })
  running = true
  const started = Date.now()
  try {
    const collected = await collectFreehireJobs({
      since: new Date(started - WINDOW_MS),
      maxPagesPerMarket: 1,
      withDescriptionPay: false,
    })
    const stats = await ingestFreehireJobs(collected.inputs, { lookUpWebsites: false })
    const body = {
      ok: collected.errors.length === 0,
      fetched: collected.markets.reduce((n, m) => n + m.fetched, 0),
      mappable: collected.inputs.length,
      created: stats.created,
      updated: stats.updated,
      skipped: stats.skipped + collected.unmappable,
      errors: collected.errors,
      seconds: Math.round((Date.now() - started) / 1000),
    }
    console.log('[freehire-recent]', JSON.stringify(body))
    return NextResponse.json(body)
  } catch (err) {
    console.error('[freehire-recent] run failed:', err instanceof Error ? err.message.split('\n')[0] : err)
    return NextResponse.json({ ok: false, error: 'run failed' }, { status: 500 })
  } finally {
    running = false
  }
}
