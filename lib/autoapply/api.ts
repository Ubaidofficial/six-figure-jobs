// JSON handlers behind /api/autoapply/*. The route files check the switch first and only then import this module.
// Same rules as the kit and billing APIs: same-origin only, a signed-in user that still exists, a per-user rate limit,
// and the user id always from the session, never from the request.

import { AutoApplyError, approveApplication, cancelApplication, prepareApplication, saveDraft } from './service'

import { getSessionUser } from '@/lib/auth/session'
import { isSameOrigin } from '@/lib/billing/api'
import { createRateLimiter } from '@/lib/jobs/jobReport'

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
  if (err instanceof AutoApplyError) return json({ error: err.code, details: err.details ?? null }, err.status)
  console.error('[autoapply] request failed', err instanceof Error ? err.name : 'unknown') // name only: messages can carry user text
  return json({ error: 'server_error' }, 500)
}

const idOf = (b: Record<string, unknown> | null) => (typeof b?.id === 'string' && b.id.length <= 60 ? b.id : null)

export async function postPrepare(req: Request): Promise<Response> {
  const auth = await authorize(req, 'ap-prepare', 10)
  if (auth instanceof Response) return auth
  const b = await body(req)
  const job = typeof b?.job === 'string' ? b.job.trim() : ''
  if (!job || job.length > 300) return json({ error: 'bad_request' }, 400)
  try {
    const app = await prepareApplication(auth.userId, job)
    return json({ id: app.id })
  } catch (err) {
    return failure(err)
  }
}

export async function patchDraft(req: Request): Promise<Response> {
  const auth = await authorize(req, 'ap-draft', 60)
  if (auth instanceof Response) return auth
  const b = await body(req)
  const id = idOf(b)
  if (!id || !b) return json({ error: 'bad_request' }, 400)
  const answers = b.answers && typeof b.answers === 'object' && !Array.isArray(b.answers) ? (b.answers as Record<string, unknown>) : undefined
  const profile = b.profile && typeof b.profile === 'object' && !Array.isArray(b.profile) ? (b.profile as Record<string, unknown>) : undefined
  try {
    const r = await saveDraft(auth.userId, id, { answers, profile, consent: b.consent })
    return json({ plan: r.plan, errors: r.errors, missing: r.missing, hash: r.hash })
  } catch (err) {
    return failure(err)
  }
}

export async function postApprove(req: Request): Promise<Response> {
  const auth = await authorize(req, 'ap-approve', 10)
  if (auth instanceof Response) return auth
  const b = await body(req)
  const id = idOf(b)
  if (!id || !b) return json({ error: 'bad_request' }, 400)
  try {
    const app = await approveApplication(auth.userId, id, b.hash)
    return json({ status: app.status })
  } catch (err) {
    return failure(err)
  }
}

export async function postCancel(req: Request): Promise<Response> {
  const auth = await authorize(req, 'ap-cancel', 30)
  if (auth instanceof Response) return auth
  const id = idOf(await body(req))
  if (!id) return json({ error: 'bad_request' }, 400)
  try {
    await cancelApplication(auth.userId, id)
    return json({ ok: true })
  } catch (err) {
    return failure(err)
  }
}
