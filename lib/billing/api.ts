// JSON handlers behind /api/billing/checkout and /api/billing/portal. The route files do the env gate first and only
// then import this module.
//
// Every request must be: same-origin (Origin header equals the site origin, which blocks cross-site form posts and
// fetches even though the cookie is SameSite=Lax), from a signed-in user that still exists, and under a per-user rate
// limit. The browser says only which product button was pressed; price, mode and credits come from env.

import { BillingError, createCheckoutUrl, createPortalUrl } from './checkout'
import { isProductKey } from './config'
import { getStripe } from './stripe'

import { getSessionUser } from '@/lib/auth/session'
import { createRateLimiter } from '@/lib/jobs/jobReport'
import { prisma } from '@/lib/prisma'
import { getSiteUrl } from '@/lib/seo/site'

const limiter = createRateLimiter()
const PER_USER = { limit: 10, windowMs: 10 * 60 * 1000 }

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export function isSameOrigin(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === new URL(env.AUTH_URL?.trim() || getSiteUrl()).origin
  } catch {
    return false
  }
}

async function authorize(req: Request): Promise<{ userId: string } | Response> {
  if (!isSameOrigin(req)) return json({ error: 'forbidden' }, 403)
  const user = await getSessionUser()
  if (!user) return json({ error: 'unauthenticated' }, 401)
  if (!limiter.allow(`user:${user.id}`, PER_USER.limit, PER_USER.windowMs)) return json({ error: 'rate_limited' }, 429)
  return { userId: user.id }
}

function failure(err: unknown): Response {
  if (err instanceof BillingError) return json({ error: err.code }, err.status)
  // Unexpected: log the error name only (messages from Stripe or the database can carry customer details).
  console.error('[billing] request failed', err instanceof Error ? err.name : 'unknown')
  return json({ error: 'server_error' }, 500)
}

export async function postCheckout(req: Request): Promise<Response> {
  const auth = await authorize(req)
  if (auth instanceof Response) return auth
  let product: unknown
  try {
    product = ((await req.json()) as { product?: unknown }).product
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!isProductKey(product)) return json({ error: 'bad_request' }, 400)
  try {
    return json({ url: await createCheckoutUrl(auth.userId, product, { stripe: getStripe(), db: prisma }) })
  } catch (err) {
    return failure(err)
  }
}

export async function postPortal(req: Request): Promise<Response> {
  const auth = await authorize(req)
  if (auth instanceof Response) return auth
  try {
    return json({ url: await createPortalUrl(auth.userId, { stripe: getStripe(), db: prisma }) })
  } catch (err) {
    return failure(err)
  }
}
