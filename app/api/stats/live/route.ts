// GET /api/stats/live -> { jobs, companies, newThisWeek, countries, catalog, refreshedAt, checkedAt }
// The numbers in the "Live now" band (homepage and pricing page), polled every 30 seconds while a visitor has the page
// open. Counts only, no job rows. The answer is the same for everyone, so it is cached at the edge for 30 seconds; the loaders
// behind it have their own short caches.
import { NextResponse } from 'next/server'

import { loadLiveSiteStats } from '@/lib/jobs/liveSiteStats'

export async function GET() {
  const stats = await loadLiveSiteStats()
  if (!stats) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(
    { ...stats, checkedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  )
}
