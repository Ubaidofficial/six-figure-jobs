// app/api/cron/scrape/route.ts
// Vercel Cron endpoint for daily job scraping
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/scrape", "schedule": "0 6 * * *" }] }

import { NextResponse } from 'next/server'

// Vercel Serverless Function config
export const maxDuration = 300 // 5 minutes max
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Security: Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // For Vercel cron, we just return success
  // The actual scraping should be done via a separate long-running process
  // or triggered externally (GitHub Actions, etc.)
  return NextResponse.json({
    success: true,
    message: 'Cron endpoint ready. Use scripts/dailyScrape.ts for actual scraping.',
  })
}

export async function POST(request: Request) {
  return GET(request)
}
