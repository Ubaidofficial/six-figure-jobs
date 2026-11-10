import { ADMIN_LOGIN_LIMITS, checkAdminLoginLimit } from '@/lib/admin/loginRateLimit'
import { COOKIE_MAX_AGE, createSessionToken, sign, verifySessionToken } from '@/lib/admin/session'
import { createRateLimiter } from '@/lib/jobs/jobReport'

const headersFor = (ip: string) => new Headers({ 'x-forwarded-for': ip })

describe('admin session tokens', () => {
  const tokenAt = (issuedAt: number) => {
    const payload = `admin:${issuedAt}`
    return Buffer.from(`${payload}:${sign(payload)}`).toString('base64url')
  }

  it('accepts a fresh token', () => {
    expect(verifySessionToken(createSessionToken())).toBe(true)
  })

  it('rejects a token older than the cookie lifetime', () => {
    const now = Date.now()
    expect(verifySessionToken(tokenAt(now - COOKIE_MAX_AGE * 1000 + 1000), now)).toBe(true)
    expect(verifySessionToken(tokenAt(now - COOKIE_MAX_AGE * 1000 - 1000), now)).toBe(false)
  })

  it('rejects a token dated in the future or with a tampered signature', () => {
    const now = Date.now()
    expect(verifySessionToken(tokenAt(now + 10 * 60 * 1000), now)).toBe(false)
    const forged = Buffer.from(`admin:${now}:${'0'.repeat(64)}`).toString('base64url')
    expect(verifySessionToken(forged, now)).toBe(false)
    expect(verifySessionToken('not-a-token', now)).toBe(false)
  })
})

describe('admin login rate limit', () => {
  it('blocks an IP after its limit and lets another IP through', () => {
    const limiter = createRateLimiter()
    const now = 1_000_000
    for (let i = 0; i < ADMIN_LOGIN_LIMITS.perIp.limit; i++) {
      expect(checkAdminLoginLimit(headersFor('1.1.1.1'), now, limiter)).toBeNull()
    }
    expect(checkAdminLoginLimit(headersFor('1.1.1.1'), now, limiter)).toBe(900)
    expect(checkAdminLoginLimit(headersFor('2.2.2.2'), now, limiter)).toBeNull()
    // The window slides: after 15 minutes the first IP may try again.
    expect(checkAdminLoginLimit(headersFor('1.1.1.1'), now + ADMIN_LOGIN_LIMITS.perIp.windowMs, limiter)).toBeNull()
  })

  it('caps attempts across all IPs', () => {
    const limiter = createRateLimiter()
    const now = 1_000_000
    for (let i = 0; i < ADMIN_LOGIN_LIMITS.global.limit; i++) {
      expect(checkAdminLoginLimit(headersFor(`10.0.0.${i}`), now, limiter)).toBeNull()
    }
    expect(checkAdminLoginLimit(headersFor('10.0.1.1'), now, limiter)).toBe(900)
  })
})
