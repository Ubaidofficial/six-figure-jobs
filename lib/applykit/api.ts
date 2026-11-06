// JSON handlers behind /api/kit/*. The route files do the env gate first and only then import this module.
// Same rules as the billing API: same-origin only, signed-in user that still exists, per-user rate limit, and the
// user id always comes from the session, never from the request.

import { NOTES_MAX_CHARS, RESUME_MAX_CHARS, RESUME_MIN_CHARS, isKitStatus } from './config'
import { KitError, generateKit } from './generate'

import { isSameOrigin } from '@/lib/billing/api'
import { getSessionUser } from '@/lib/auth/session'
import { createRateLimiter } from '@/lib/jobs/jobReport'
import { prisma } from '@/lib/prisma'

const limiter = createRateLimiter()
const WINDOW = 10 * 60 * 1000

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function authorize(req: Request, bucket: string, limit: number): Promise<{ userId: string } | Response> {
  if (!isSameOrigin(req)) return json({ error: 'forbidden' }, 403)
  const user = await getSessionUser()
  if (!user) return json({ error: 'unauthenticated' }, 401)
  if (!limiter.allow(`${bucket}:${user.id}`, limit, WINDOW)) return json({ error: 'rate_limited' }, 429)
  return { userId: user.id }
}

async function body(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function failure(err: unknown): Response {
  if (err instanceof KitError) return json({ error: err.code }, err.status)
  console.error('[kit] request failed', err instanceof Error ? err.name : 'unknown') // name only: messages can carry user text
  return json({ error: 'server_error' }, 500)
}

export async function putResume(req: Request): Promise<Response> {
  const auth = await authorize(req, 'resume', 30)
  if (auth instanceof Response) return auth
  const b = await body(req)
  const text = typeof b?.text === 'string' ? b.text.replace(/\r\n/g, '\n').split('\u0000').join('').trim() : null
  if (text === null) return json({ error: 'bad_request' }, 400)
  if (text.length < RESUME_MIN_CHARS) return json({ error: 'resume_too_short' }, 400)
  if (text.length > RESUME_MAX_CHARS) return json({ error: 'resume_too_long' }, 400)
  try {
    await prisma.resume.upsert({ where: { userId: auth.userId }, create: { userId: auth.userId, text }, update: { text } })
    return json({ ok: true })
  } catch (err) {
    return failure(err)
  }
}

export async function deleteResume(req: Request): Promise<Response> {
  const auth = await authorize(req, 'resume', 30)
  if (auth instanceof Response) return auth
  try {
    await prisma.resume.deleteMany({ where: { userId: auth.userId } })
    return json({ ok: true })
  } catch (err) {
    return failure(err)
  }
}

export async function postGenerate(req: Request): Promise<Response> {
  const auth = await authorize(req, 'generate', 8)
  if (auth instanceof Response) return auth
  const b = await body(req)
  const job = typeof b?.job === 'string' ? b.job.trim() : ''
  if (!job || job.length > 300) return json({ error: 'bad_request' }, 400)
  try {
    const { kit, charged } = await generateKit(auth.userId, job)
    return json({ kit, charged })
  } catch (err) {
    return failure(err)
  }
}

export async function patchStatus(req: Request): Promise<Response> {
  const auth = await authorize(req, 'status', 60)
  if (auth instanceof Response) return auth
  const b = await body(req)
  if (!b || typeof b.id !== 'string') return json({ error: 'bad_request' }, 400)
  const data: { status?: string; appliedAt?: Date | null; notes?: string | null } = {}
  if (b.status !== undefined) {
    if (!isKitStatus(b.status)) return json({ error: 'bad_request' }, 400)
    data.status = b.status
    data.appliedAt = b.status === 'saved' ? null : undefined
  }
  if (b.notes !== undefined) {
    if (typeof b.notes !== 'string' || b.notes.length > NOTES_MAX_CHARS) return json({ error: 'bad_request' }, 400)
    data.notes = b.notes.trim() || null
  }
  if (Object.keys(data).length === 0) return json({ error: 'bad_request' }, 400)
  try {
    // userId in the where clause: a user can only touch their own rows.
    const row = await prisma.applicationKit.findFirst({ where: { id: b.id, userId: auth.userId }, select: { id: true, appliedAt: true } })
    if (!row) return json({ error: 'not_found' }, 404)
    if (data.status && data.status !== 'saved' && !row.appliedAt) data.appliedAt = new Date()
    await prisma.applicationKit.update({ where: { id: row.id }, data })
    return json({ ok: true })
  } catch (err) {
    return failure(err)
  }
}
