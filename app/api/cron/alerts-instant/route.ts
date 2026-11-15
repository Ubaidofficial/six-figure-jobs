// GET /api/cron/alerts-instant — mails the Pro "instant" job alerts (lib/alerts/service.ts runDigests with
// frequencies ['instant']). Point a scheduler at it every 15 minutes with `Authorization: Bearer <CRON_SECRET>`, like the
// other /api/cron routes. It runs inside the app, so it costs no GitHub runner minutes. 404 while alerts are off, 401
// without the secret. A second call while a run is still going does nothing.
import { NextResponse } from 'next/server'

import { alertsEnabled } from '@/lib/alerts/config'
import { runDigests, sendMail } from '@/lib/alerts/service'
import { notFoundResponse } from '@/lib/accounts/enabled'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

let running = false

function authorized(req: Request): boolean {
  const auth = req.headers.get('authorization')
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRET_NEXT].filter(Boolean)
  return Boolean(auth) && secrets.some((s) => auth === `Bearer ${s}`)
}

export async function GET(req: Request) {
  if (!alertsEnabled()) return notFoundResponse()
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  if (running) return NextResponse.json({ ok: true, skipped: 'previous run still going' })
  running = true
  try {
    const stats = await runDigests({ frequencies: ['instant'], send: sendMail, log: (line) => console.error(line) })
    return NextResponse.json({ ok: stats.failed === 0, ...stats })
  } catch (err) {
    console.error('[alerts] instant run failed:', err instanceof Error ? err.message.split('\n')[0] : err)
    return NextResponse.json({ ok: false, error: 'run failed' }, { status: 500 })
  } finally {
    running = false
  }
}
