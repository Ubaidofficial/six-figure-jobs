// Edge-safe session token helpers — no Prisma, no next/headers
// Used by middleware.ts (Edge Runtime) and lib/admin/auth.ts
import { createHmac, createHash } from 'crypto'

// Pure-JS constant-time string comparison — works in both Edge Runtime and Node.js
// (timingSafeEqual from node:crypto is NOT available in Edge Runtime)
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

export const COOKIE_NAME = 'admin_session'
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export function getSecret(): string {
  const explicit = process.env.ADMIN_JWT_SECRET
  if (explicit && explicit.length > 0) return explicit
  const dbUrl = process.env.DATABASE_URL ?? 'sixfigurejobs-fallback-dev'
  return createHash('sha256').update('admin-session:' + dbUrl).digest('hex')
}

export function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

/**
 * A session for one admin account: `admin:<user id>:<password fingerprint>:<issued at>`, signed. getAdminSession checks
 * the account still exists with the same password, so a password change, or the account being removed, ends every
 * session made before it (found 2026-11-24: the token named no account, so it outlived both). Without `user` (tests and
 * the Edge check of the cookie) the payload is `admin:<issued at>`, which getAdminSession refuses.
 */
export function createSessionToken(user?: { id: string; fingerprint: string }): string {
  const payload = user ? `admin:${user.id}:${user.fingerprint}:${Date.now()}` : `admin:${Date.now()}`
  const sig = sign(payload)
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

/** The account a signed token names (no signature or age check: call verifySessionToken first). */
export function sessionAccount(token: string): { id: string; fingerprint: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const parts = decoded.split(':')
    // admin, id, fingerprint, issuedAt, signature
    return parts.length === 5 && parts[0] === 'admin' && parts[1] && parts[2] ? { id: parts[1], fingerprint: parts[2] } : null
  } catch {
    return null
  }
}

export function verifySessionToken(token: string, now: number = Date.now()): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const lastColon = decoded.lastIndexOf(':')
    const payload = decoded.slice(0, lastColon)
    const sig = decoded.slice(lastColon + 1)
    const expected = sign(payload)
    if (!safeEqual(sig, expected)) return false
    // The cookie expires after COOKIE_MAX_AGE in the browser; a copied token must stop working then too.
    const issuedAt = Number(payload.slice(payload.lastIndexOf(':') + 1))
    // A minute of tolerance for clock differences between instances.
    return Number.isFinite(issuedAt) && issuedAt <= now + 60_000 && now - issuedAt < COOKIE_MAX_AGE * 1000
  } catch {
    return false
  }
}

// Cookie attribute object (no name/value) — use with the 3-arg ResponseCookies.set()
// e.g. res.cookies.set(COOKIE_NAME, token, cookieAttrs())
export function cookieAttrs() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  }
}
