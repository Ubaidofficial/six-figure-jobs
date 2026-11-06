// GET /api/jobs/latest?since=<ISO time> -> { items, newestAt, checkedAt }
// The newest jobs we added, only those added after `since` when it is given. Polled by the homepage live feed. The
// answer is the same for everyone, so it is cached at the edge for a minute; the load behind it is cached too.
import { NextResponse } from 'next/server'

import { loadLatestFeed } from '@/lib/jobs/latestFeed'

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('since')
  const since = raw ? Date.parse(raw) : NaN
  try {
    const feed = await loadLatestFeed()
    const items = Number.isFinite(since) ? feed.items.filter((i) => Date.parse(i.addedAt) > since) : feed.items
    return NextResponse.json(
      { items, newestAt: feed.newestAt, checkedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
    )
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
