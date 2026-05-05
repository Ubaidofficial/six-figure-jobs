// app/api/indexing/notify/route.ts
// Internal endpoint: notify Google Indexing API for a batch of job URLs.
// Called by the ingest pipeline after new jobs are scraped.
//
// Auth: Authorization: Bearer <INDEXING_API_INTERNAL_KEY>
//
// POST body (JSON):
//   { urls: string[] }                        — notify specific URLs
//   { type?: "URL_UPDATED" | "URL_DELETED" }  — default: URL_UPDATED
//   { concurrency?: number }                  — default: 4, max: 16

import { NextResponse } from 'next/server'
import {
  notifyUrls,
  hasIndexingCredentials,
  type IndexingRequestType,
} from '../../../../lib/indexing/googleIndexingClient'
import { getSiteUrl } from '../../../../lib/seo/site'

export const dynamic = 'force-dynamic'

const MAX_URLS_PER_REQUEST = 200
const SITE_URL = getSiteUrl()

function isAuthorized(req: Request): boolean {
  const internalKey = process.env.INDEXING_API_INTERNAL_KEY?.trim()
  if (!internalKey) {
    // If no key is configured, fall back to Railway-internal check:
    // only allow requests from localhost / Railway private network.
    const host = req.headers.get('host') ?? ''
    return host.startsWith('localhost') || host.startsWith('127.')
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  return token === internalKey
}

function isJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.pathname.startsWith('/job/')
  } catch {
    return false
  }
}

function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    // Accept absolute URLs on our domain or path-only inputs
    if (parsed.origin === SITE_URL || parsed.protocol === 'https:') return parsed.href
    return null
  } catch {
    // Could be a path like /job/some-slug
    if (url.startsWith('/')) return `${SITE_URL}${url}`
    return null
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!hasIndexingCredentials()) {
    return NextResponse.json(
      {
        error: 'Google Indexing API credentials not configured',
        hint: 'Set GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON or GOOGLE_INDEXING_CLIENT_EMAIL + GOOGLE_INDEXING_PRIVATE_KEY',
      },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null || !Array.isArray((body as any).urls)) {
    return NextResponse.json({ error: 'Body must be { urls: string[] }' }, { status: 400 })
  }

  const raw = (body as any).urls as unknown[]
  const type: IndexingRequestType =
    (body as any).type === 'URL_DELETED' ? 'URL_DELETED' : 'URL_UPDATED'
  const concurrency = Math.max(1, Math.min(Number((body as any).concurrency) || 4, 16))

  // Normalize + deduplicate + validate URLs
  const urls = Array.from(
    new Set(
      raw
        .filter((u): u is string => typeof u === 'string')
        .map(normalizeUrl)
        .filter((u): u is string => u !== null && isJobUrl(u)),
    ),
  ).slice(0, MAX_URLS_PER_REQUEST)

  if (urls.length === 0) {
    return NextResponse.json({ submitted: 0, results: [], message: 'No valid job URLs provided' })
  }

  let results
  try {
    results = await notifyUrls(urls, { type, concurrency })
  } catch (err) {
    console.error('[indexing/notify] fatal error:', err)
    return NextResponse.json(
      { error: 'Failed to obtain access token', detail: String((err as Error).message ?? err) },
      { status: 502 },
    )
  }

  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  console.log(`[indexing/notify] type=${type} submitted=${succeeded} failed=${failed}`)

  return NextResponse.json({
    submitted: succeeded,
    failed,
    results,
  })
}
