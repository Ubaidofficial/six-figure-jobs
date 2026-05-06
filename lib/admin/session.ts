// Edge-safe session token helpers — no Prisma, no next/headers
// Used by middleware.ts (Edge Runtime) and lib/admin/auth.ts
import { createHmac, createHash, timingSafeEqual } from 'crypto'

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

export function createSessionToken(): string {
  const payload = `admin:${Date.now()}`
  const sig = sign(payload)
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifySessionToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const lastColon = decoded.lastIndexOf(':')
    const payload = decoded.slice(0, lastColon)
    const sig = decoded.slice(lastColon + 1)
    const expected = sign(payload)
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  }
}

export function clearCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  }
}
