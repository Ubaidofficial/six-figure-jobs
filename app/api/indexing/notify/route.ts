// app/api/indexing/notify/route.ts
// Internal endpoint: notify/enqueue Google Indexing API for job URLs.
//
// Auth: Authorization: Bearer <INDEXING_API_INTERNAL_KEY>
//
// POST body (JSON):
//   {
//     "urls": ["https://www.6figjobs.com/job/some-slug"],
//     "type": "URL_UPDATED" | "URL_DELETED",
//     "dryRun": boolean (optional, defaults to true)
//   }

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import {
  validateJobIndexingUrl,
  verifyJobIndexingUpdateSafety,
  verifyJobIndexingDeleteSafety,
} from '../../../../lib/indexing/safetyGates'
import { parseJobSlugParam } from '../../../../lib/jobs/jobSlug'

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<NextResponse> {
  const internalKey = process.env.INDEXING_API_INTERNAL_KEY?.trim()
  const isProduction = process.env.NODE_ENV === 'production'

  // Block weak or missing keys in production
  if (isProduction) {
    if (!internalKey || internalKey.length < 16) {
      return NextResponse.json(
        { error: 'Forbidden: Weak or missing INDEXING_API_INTERNAL_KEY in production' },
        { status: 403 },
      )
    }
  }

  // Extract bearer token
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  let authorized = false
  if (internalKey) {
    authorized = token === internalKey
  } else {
    // Local/dev fallback
    const host = req.headers.get('host') ?? ''
    authorized = host.startsWith('localhost') || host.startsWith('127.')
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse POST body
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null || !Array.isArray(body.urls)) {
    return NextResponse.json({ error: 'Body must be { urls: string[] }' }, { status: 400 })
  }

  const rawUrls = body.urls as unknown[]
  const type = body.type || 'URL_UPDATED'

  if (type !== 'URL_UPDATED' && type !== 'URL_DELETED') {
    return NextResponse.json(
      { error: 'Invalid request type. Must be URL_UPDATED or URL_DELETED' },
      { status: 400 },
    )
  }

  // Determine dry-run status
  const dryRunEnv = process.env.INDEXING_API_DRY_RUN !== '0'
  const dryRun = body.dryRun !== false || dryRunEnv

  const accepted: string[] = []
  const skipped: { url: string; reason: string }[] = []
  const errors: { url: string; error: string }[] = []

  for (const rawUrl of rawUrls) {
    if (typeof rawUrl !== 'string') {
      errors.push({ url: String(rawUrl), error: 'url_must_be_string' })
      continue
    }

    const url = rawUrl.trim()

    // 1. Basic URL validation
    const urlCheck = validateJobIndexingUrl(url)
    if (!urlCheck.valid) {
      errors.push({ url, error: urlCheck.reason || 'invalid_url' })
      continue
    }

    // 2. Extract job slug and parse details
    let pathname: string
    try {
      pathname = new URL(url).pathname
    } catch {
      errors.push({ url, error: 'malformed_url_parsing' })
      continue
    }

    const slug = pathname.split('/').pop() || ''
    const { jobId: parsedJobId, shortId } = parseJobSlugParam(slug)
    const ors: any[] = []
    if (parsedJobId) ors.push({ id: parsedJobId })
    if (shortId) ors.push({ shortId })

    if (ors.length === 0) {
      errors.push({ url, error: 'invalid_slug_identifier' })
      continue
    }

    // 3. Resolve job in database
    const job = await prisma.job.findFirst({
      where: { OR: ors },
    })

    if (!job) {
      errors.push({ url, error: 'job_not_found_in_db' })
      continue
    }

    // 4. Verify safety gates
    let safety: { safe: boolean; reason?: string }
    if (type === 'URL_UPDATED') {
      safety = await verifyJobIndexingUpdateSafety(job.id, url)
    } else {
      safety = await verifyJobIndexingDeleteSafety(job.id, url)
    }

    if (!safety.safe) {
      skipped.push({ url, reason: safety.reason || 'safety_gate_rejected' })
      continue
    }

    // 5. Enqueue (or simulate enqueuing)
    if (dryRun) {
      accepted.push(url)
    } else {
      try {
        await prisma.jobIndexingQueue.create({
          data: {
            jobId: job.id,
            url,
            type,
            reason: 'api_route',
            status: 'pending',
            dedupeKey: `${job.id}:${type}:pending`,
          },
        })
        accepted.push(url)
      } catch (err: any) {
        if (err?.code === 'P2002') {
          skipped.push({ url, reason: 'already_queued_pending' })
        } else {
          errors.push({ url, error: err.message || String(err) })
        }
      }
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    dryRun,
    accepted,
    skipped,
    errors,
  })
}

