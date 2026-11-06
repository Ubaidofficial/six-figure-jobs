// Rate limit for "email me a sign-in link", per address and per client IP. Runs in the route handler BEFORE Auth.js
// sees the request, so every attempt counts whether or not it would have succeeded.
//
// In memory (the same limiter report-job uses): per server instance, reset on every deploy or restart. Keys are
// hashed, so no address or IP is held in plain text. It is a brake on abuse (inbox flooding, SMTP cost), not an
// audit log. With several instances the effective limit is the number of instances times these numbers.

import { createHash } from 'node:crypto'

import { createRateLimiter } from '@/lib/jobs/jobReport'

export const SIGN_IN_LIMITS = {
  perAddress: { limit: 3, windowMs: 15 * 60 * 1000 },
  perIp: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const

const defaultLimiter = createRateLimiter()

const hash = (scope: string, value: string) =>
  createHash('sha256').update(`sfj-signin:${scope}:${value}`).digest('hex').slice(0, 32)

/**
 * The client address as the platform's proxy reports it. Entries are appended on the right as a request passes through
 * proxies, so the entry `hops` from the right is the one the platform itself saw; entries further left are whatever
 * the client claimed and are ignored. AUTH_CLIENT_IP_HOPS (default 1) is how many proxies sit in front of the app.
 */
export function clientIp(headers: Pick<Headers, 'get'>, hops = 1): string {
  const parts = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return headers.get('x-real-ip')?.trim() || 'unknown'
  return parts[Math.max(0, parts.length - Math.max(1, hops))]
}

export type SignInLimitResult = { allowed: true } | { allowed: false; scope: 'ip' | 'address'; retryAfterSeconds: number }

/** Counts this attempt. The IP is checked first so a flood from one address cannot burn through another person's budget. */
export function checkSignInLimit(
  input: { ip: string; email: string | null },
  now: number = Date.now(),
  limiter: ReturnType<typeof createRateLimiter> = defaultLimiter,
): SignInLimitResult {
  const { perIp, perAddress } = SIGN_IN_LIMITS
  if (!limiter.allow(`ip:${hash('ip', input.ip)}`, perIp.limit, perIp.windowMs, now)) {
    return { allowed: false, scope: 'ip', retryAfterSeconds: Math.ceil(perIp.windowMs / 1000) }
  }
  if (input.email) {
    const normalised = input.email.trim().toLowerCase()
    if (!limiter.allow(`addr:${hash('addr', normalised)}`, perAddress.limit, perAddress.windowMs, now)) {
      return { allowed: false, scope: 'address', retryAfterSeconds: Math.ceil(perAddress.windowMs / 1000) }
    }
  }
  return { allowed: true }
}

/** True for the request that asks Auth.js to email a link. */
export function isMagicLinkRequest(req: Request): boolean {
  return req.method === 'POST' && /\/signin\/nodemailer\/?$/.test(new URL(req.url).pathname)
}

async function readEmail(req: Request): Promise<string | null> {
  try {
    const clone = req.clone()
    const type = clone.headers.get('content-type') ?? ''
    const raw = type.includes('application/json')
      ? ((await clone.json()) as { email?: unknown }).email
      : (await clone.formData()).get('email')
    return typeof raw === 'string' && raw.length > 0 && raw.length <= 320 ? raw : null
  } catch {
    return null
  }
}

/**
 * Returns a response to send instead of calling Auth.js when the request is over a limit, or null to carry on.
 * Matches what Auth.js itself answers: JSON {url} for its fetch client (header X-Auth-Return-Redirect), otherwise a redirect.
 */
export async function rateLimitMagicLink(req: Request, env: Record<string, string | undefined> = process.env) {
  if (!isMagicLinkRequest(req)) return null
  const hops = Number(env.AUTH_CLIENT_IP_HOPS)
  const result = checkSignInLimit({
    ip: clientIp(req.headers, Number.isInteger(hops) && hops > 0 ? hops : 1),
    email: await readEmail(req),
  })
  if (result.allowed) return null

  const headers = { 'Retry-After': String(result.retryAfterSeconds), 'Cache-Control': 'no-store' }
  if (req.headers.get('x-auth-return-redirect')) {
    // Absolute, because Auth.js's browser client parses it with new URL(). Pinned to AUTH_URL, not the Host header.
    const target = new URL('/sign-in?error=RateLimited', env.AUTH_URL || req.url)
    return Response.json({ url: target.toString() }, { status: 429, headers })
  }
  return new Response(null, { status: 303, headers: { ...headers, Location: '/sign-in?error=RateLimited' } })
}
