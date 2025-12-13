// app/api/cron/scrape/route.ts
import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function isAuthorized(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

function runDailyScrapeV2() {
  // fire-and-forget: run in background
  const child = spawn(
    'npx',
    ['tsx', 'scripts/dailyScrapeV2.ts', '--mode=all', '--concurrency=5'],
    { stdio: 'inherit', env: process.env }
  )

  child.on('error', (err) => console.error('[cron] spawn error', err))
  child.on('exit', (code) => console.log('[cron] scraper exit code', code))
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  runDailyScrapeV2()

  return NextResponse.json({
    success: true,
    message: 'Started dailyScrapeV2 in background',
  })
}

// Optional: allow GET for quick auth test
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ success: true, message: 'OK' })
}
