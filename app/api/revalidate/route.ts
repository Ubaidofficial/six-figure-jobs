// app/api/revalidate/route.ts
// On-Demand ISR — purge Next.js cache for a path or tag.
//
// Usage:
//   POST /api/revalidate
//   Authorization: Bearer <REVALIDATION_SECRET>
//   Content-Type: application/json
//
//   Body (revalidate by path):
//     { "path": "/jobs/software-engineer" }
//
//   Body (revalidate by tag):
//     { "tag": "jobs" }
//
//   Body (revalidate multiple):
//     { "paths": ["/jobs/software-engineer", "/salary/software-engineer"], "tags": ["jobs"] }
//
// Also supports GET for simple single-path/tag revalidation:
//   GET /api/revalidate?path=/jobs/software-engineer&secret=<REVALIDATION_SECRET>

import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

function getSecret(): string | null {
  return process.env.REVALIDATION_SECRET ?? null
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

function ok(revalidated: { paths: string[]; tags: string[] }) {
  return new Response(
    JSON.stringify({ ok: true, revalidated, now: Date.now() }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// GET /api/revalidate?secret=xxx&path=/foo  (simple webhook-style)
export async function GET(req: NextRequest) {
  const secret = getSecret()
  const { searchParams } = req.nextUrl

  const providedSecret = searchParams.get('secret')
  if (!secret || providedSecret !== secret) return unauthorized()

  const path = searchParams.get('path')
  const tag = searchParams.get('tag')

  if (!path && !tag) return badRequest('Provide at least one of: path, tag')

  const revalidatedPaths: string[] = []
  const revalidatedTags: string[] = []

  if (path) {
    revalidatePath(path)
    revalidatedPaths.push(path)
  }
  if (tag) {
    revalidateTag(tag)
    revalidatedTags.push(tag)
  }

  return ok({ paths: revalidatedPaths, tags: revalidatedTags })
}

// POST /api/revalidate (Authorization: Bearer <secret>)
export async function POST(req: NextRequest) {
  const secret = getSecret()
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!secret || token !== secret) return unauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const b = body as Record<string, unknown>

  // Normalise single path/tag + arrays
  const paths: string[] = [
    ...(typeof b.path === 'string' ? [b.path] : []),
    ...(Array.isArray(b.paths) ? (b.paths as unknown[]).filter((p): p is string => typeof p === 'string') : []),
  ]
  const tags: string[] = [
    ...(typeof b.tag === 'string' ? [b.tag] : []),
    ...(Array.isArray(b.tags) ? (b.tags as unknown[]).filter((t): t is string => typeof t === 'string') : []),
  ]

  if (paths.length === 0 && tags.length === 0) {
    return badRequest('Provide at least one of: path, paths, tag, tags')
  }

  // Cap to prevent abuse
  const MAX = 50
  const revalidatedPaths: string[] = []
  const revalidatedTags: string[] = []

  for (const p of paths.slice(0, MAX)) {
    revalidatePath(p)
    revalidatedPaths.push(p)
  }
  for (const t of tags.slice(0, MAX)) {
    revalidateTag(t)
    revalidatedTags.push(t)
  }

  return ok({ paths: revalidatedPaths, tags: revalidatedTags })
}
