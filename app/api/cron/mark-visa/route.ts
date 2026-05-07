// app/api/cron/mark-visa/route.ts
// Marks visaSponsorship = true on jobs whose descriptions contain H1B keywords
// and on jobs from H1B board sources (h1bvisajobs, myvisajobs).
//
// Call via: GET /api/cron/mark-visa
// Requires: Authorization: Bearer <CRON_SECRET>
//
// Add to Railway cron: 0 6 * * * (daily at 6 AM UTC, after scrape)

import { NextResponse } from 'next/server'
import { markVisaSponsorshipBatch, markVisaSponsorshipBySource } from '../../../../lib/jobs/markVisaSponsorship'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorized(req: Request): boolean {
  const auth = req.headers.get('authorization')
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRET_NEXT].filter(Boolean)
  if (!auth || secrets.length === 0) return false
  return secrets.some((s) => auth === `Bearer ${s}`)
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const dryRun = new URL(req.url).searchParams.get('dry') === '1'

    // 1. Mark jobs from H1B board sources
    const fromSources = await markVisaSponsorshipBySource(
      ['board:h1bvisajobs', 'board:myvisajobs'],
      dryRun,
    )

    // 2. Scan descriptions for visa keywords
    const { marked, checked } = await markVisaSponsorshipBatch({ batchSize: 500, dryRun })

    return NextResponse.json({
      ok: true,
      dryRun,
      markedFromSources: fromSources,
      markedFromKeywords: marked,
      checked,
    })
  } catch (err: any) {
    console.error('[mark-visa] error:', err)
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 })
  }
}
