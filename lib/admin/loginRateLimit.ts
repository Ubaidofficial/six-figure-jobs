// Brake on password guessing at /api/ubaid93/login: per client IP, plus a cap across all IPs so a guesser spread over
// many addresses is slowed too. Every attempt counts (the one real admin logs in rarely). In memory, per server
// instance, reset on restart, like the sign-in and report-job limiters. Keys are hashed; no IP is held in plain text.
//
// Behind Cloudflare and Railway the "client IP" can be a proxy address shared by many visitors, which is why the
// global cap exists. Trade-off: someone hammering the endpoint can keep the admin out for up to 15 minutes.

import { createHash } from 'node:crypto'

import { clientIp } from '@/lib/auth/signInRateLimit'
import { createRateLimiter } from '@/lib/jobs/jobReport'

export const ADMIN_LOGIN_LIMITS = {
  perIp: { limit: 5, windowMs: 15 * 60 * 1000 },
  global: { limit: 50, windowMs: 15 * 60 * 1000 },
} as const

const defaultLimiter = createRateLimiter()

/** Counts this attempt. Returns seconds to wait when over a limit, or null when the attempt may proceed. */
export function checkAdminLoginLimit(
  headers: Pick<Headers, 'get'>,
  now: number = Date.now(),
  limiter: ReturnType<typeof createRateLimiter> = defaultLimiter,
): number | null {
  const { perIp, global } = ADMIN_LOGIN_LIMITS
  const ipKey = createHash('sha256').update(`sfj-admin-login:${clientIp(headers)}`).digest('hex').slice(0, 32)
  if (!limiter.allow(`ip:${ipKey}`, perIp.limit, perIp.windowMs, now)) return Math.ceil(perIp.windowMs / 1000)
  if (!limiter.allow('global', global.limit, global.windowMs, now)) return Math.ceil(global.windowMs / 1000)
  return null
}
