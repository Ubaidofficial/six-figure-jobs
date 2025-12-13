import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  return !!secret && auth === `Bearer ${secret}`
}

function runScrape() {
  spawn(
    'npx',
    ['tsx', 'scripts/dailyScrapeV2.ts', '--mode=all', '--concurrency=5'],
    { env: process.env, stdio: 'inherit' }
  )
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  runScrape()
  return NextResponse.json({ success: true, message: 'Started dailyScrapeV2' })
}

export async function GET(req: Request) {
  return POST(req)
}
