// GET /api/cron/freehire-recent: runs the frequent freehire pull (lib/scrapers/freehireRecent.ts) on demand. The app
// already runs it every 5 minutes by itself (instrumentation.ts); this route is for a manual run or an outside
// scheduler. Needs `Authorization: Bearer <CRON_SECRET>`, like the other /api/cron routes; 401 without it.
import { NextResponse } from 'next/server'

import { runFreehireRecent } from '@/lib/scrapers/freehireRecent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorized(req: Request): boolean {
  const auth = req.headers.get('authorization')
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRET_NEXT].filter(Boolean)
  return Boolean(auth) && secrets.some((s) => auth === `Bearer ${s}`)
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  try {
    const result = await runFreehireRecent()
    return NextResponse.json('skipped' in result && typeof result.skipped === 'string' ? { ok: true, ...result } : result)
  } catch (err) {
    console.error('[freehire-recent] run failed:', err instanceof Error ? err.message.split('\n')[0] : err)
    return NextResponse.json({ ok: false, error: 'run failed' }, { status: 500 })
  }
}
