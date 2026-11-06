// GET /api/jobs/suggest?q=seo
// Live suggestions for the homepage search box: roles that match what has been typed and have jobs right now.
// Never an error to the page: if the lookup fails the box simply has no suggestions and the search still works.

import { NextResponse } from 'next/server'

import { loadRoleCounts } from '@/lib/roles/roleCounts'
import { suggestRoles } from '@/lib/roles/roleSuggestions'

const MAX_QUERY_LENGTH = 60

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').slice(0, MAX_QUERY_LENGTH)
  let suggestions: ReturnType<typeof suggestRoles> = []
  try {
    suggestions = suggestRoles(q, await loadRoleCounts())
  } catch (error) {
    console.error('[suggest] role lookup failed:', error instanceof Error ? error.message : error)
  }
  return NextResponse.json(
    { suggestions },
    // Counts move slowly; let the CDN and browser reuse an answer for a few minutes.
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  )
}
