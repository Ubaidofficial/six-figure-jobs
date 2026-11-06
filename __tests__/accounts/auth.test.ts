import { buildSignInEmail } from '@/lib/auth/email'
import { safeCallbackPath } from '@/lib/auth/redirect'
import {
  SIGN_IN_LIMITS,
  checkSignInLimit,
  clientIp,
  isMagicLinkRequest,
  rateLimitMagicLink,
} from '@/lib/auth/signInRateLimit'
import { sessionCookie } from '@/lib/auth/config'
import { isSameOrigin } from '@/lib/billing/api'
import { createRateLimiter } from '@/lib/jobs/jobReport'

jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }))
jest.mock('next-auth/providers/google', () => ({ __esModule: true, default: () => ({}) }))
jest.mock('next-auth/providers/nodemailer', () => ({ __esModule: true, default: () => ({}) }))

const MIN = 60 * 1000

describe('sign-in email rate limit', () => {
  it('allows 3 emails per address per window, then blocks that address only', () => {
    const limiter = createRateLimiter()
    const t0 = 1_000_000
    const attempt = (email: string, ip: string, now = t0) => checkSignInLimit({ ip, email }, now, limiter)
    // Three different IPs so only the per-address budget is in play.
    expect(attempt('a@example.test', '1.1.1.1').allowed).toBe(true)
    expect(attempt('a@example.test', '1.1.1.2').allowed).toBe(true)
    expect(attempt('a@example.test', '1.1.1.3').allowed).toBe(true)
    expect(attempt('a@example.test', '1.1.1.4')).toMatchObject({ allowed: false, scope: 'address' })
    expect(attempt('b@example.test', '1.1.1.5').allowed).toBe(true)
  })

  it('treats case and surrounding spaces as the same address', () => {
    const limiter = createRateLimiter()
    for (const e of ['A@Example.test', ' a@example.test', 'a@EXAMPLE.test']) {
      expect(checkSignInLimit({ ip: `ip-${e}`, email: e }, 5, limiter).allowed).toBe(true)
    }
    expect(checkSignInLimit({ ip: 'another', email: 'a@example.test ' }, 5, limiter)).toMatchObject({ allowed: false, scope: 'address' })
  })

  it('allows 10 per IP per window across different addresses, then blocks that IP', () => {
    const limiter = createRateLimiter()
    for (let i = 0; i < SIGN_IN_LIMITS.perIp.limit; i++) {
      expect(checkSignInLimit({ ip: '9.9.9.9', email: `user${i}@example.test` }, 10, limiter).allowed).toBe(true)
    }
    expect(checkSignInLimit({ ip: '9.9.9.9', email: 'fresh@example.test' }, 10, limiter)).toMatchObject({ allowed: false, scope: 'ip' })
    expect(checkSignInLimit({ ip: '8.8.8.8', email: 'fresh@example.test' }, 10, limiter).allowed).toBe(true)
  })

  it('an IP that is over its limit does not use up an address\'s budget', () => {
    const limiter = createRateLimiter()
    for (let i = 0; i < SIGN_IN_LIMITS.perIp.limit; i++) checkSignInLimit({ ip: 'flood', email: null }, 10, limiter)
    for (let i = 0; i < 5; i++) checkSignInLimit({ ip: 'flood', email: 'victim@example.test' }, 10, limiter)
    expect(checkSignInLimit({ ip: 'calm', email: 'victim@example.test' }, 10, limiter).allowed).toBe(true)
  })

  it('frees up again after the window', () => {
    const limiter = createRateLimiter()
    for (let i = 0; i < 3; i++) checkSignInLimit({ ip: `i${i}`, email: 'a@example.test' }, 0, limiter)
    expect(checkSignInLimit({ ip: 'x', email: 'a@example.test' }, 14 * MIN, limiter).allowed).toBe(false)
    expect(checkSignInLimit({ ip: 'x', email: 'a@example.test' }, 16 * MIN, limiter).allowed).toBe(true)
  })

  it('reads the client address from the right of X-Forwarded-For, not from what the client claims on the left', () => {
    const h = (v: string | null) => ({ get: (k: string) => (k === 'x-forwarded-for' ? v : null) }) as Pick<Headers, 'get'>
    expect(clientIp(h('6.6.6.6, 203.0.113.7'))).toBe('203.0.113.7')
    expect(clientIp(h('203.0.113.7'))).toBe('203.0.113.7')
    expect(clientIp(h('6.6.6.6, 203.0.113.7, 10.0.0.1'), 2)).toBe('203.0.113.7')
    expect(clientIp(h(null))).toBe('unknown')
  })
})

describe('rateLimitMagicLink (the request path)', () => {
  const magic = (email: string, ip: string, headers: Record<string, string> = {}) =>
    new Request('https://www.6figjobs.com/api/auth/signin/nodemailer', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip, ...headers },
      body: new URLSearchParams({ email, csrfToken: 'x' }),
    })

  it('only inspects the magic-link request, not Google sign-in, GET, or the callback', () => {
    expect(isMagicLinkRequest(magic('a@b.c', '1.1.1.1'))).toBe(true)
    expect(isMagicLinkRequest(new Request('https://x.test/api/auth/signin/google', { method: 'POST' }))).toBe(false)
    expect(isMagicLinkRequest(new Request('https://x.test/api/auth/signin/nodemailer'))).toBe(false)
    expect(isMagicLinkRequest(new Request('https://x.test/api/auth/callback/nodemailer', { method: 'POST' }))).toBe(false)
  })

  it('lets the first requests through and answers 429 JSON with a Retry-After once an address is over its limit', async () => {
    const ip = (n: number) => `10.1.0.${n}`
    const addr = `limit-${Date.now()}@example.test`
    for (let i = 0; i < SIGN_IN_LIMITS.perAddress.limit; i++) {
      expect(await rateLimitMagicLink(magic(addr, ip(i)))).toBeNull()
    }
    const res = (await rateLimitMagicLink(magic(addr, ip(50), { 'x-auth-return-redirect': '1' }), { AUTH_URL: 'https://www.6figjobs.com' }))!
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe(String(15 * 60))
    expect(await res.json()).toEqual({ url: 'https://www.6figjobs.com/sign-in?error=RateLimited' })
  })

  it('without the fetch-client header it redirects to /sign-in with a relative Location (no Host-header echo)', async () => {
    const addr = `redir-${Date.now()}@example.test`
    for (let i = 0; i < SIGN_IN_LIMITS.perAddress.limit; i++) await rateLimitMagicLink(magic(addr, `10.2.0.${i}`))
    const res = (await rateLimitMagicLink(magic(addr, '10.2.0.99')))!
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/sign-in?error=RateLimited')
  })

  it('still rate limits per IP when the body has no usable email', async () => {
    const broken = () =>
      new Request('https://www.6figjobs.com/api/auth/signin/nodemailer', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.3.0.1', 'content-type': 'application/json' },
        body: 'not json',
      })
    let blocked = 0
    for (let i = 0; i < SIGN_IN_LIMITS.perIp.limit + 2; i++) if (await rateLimitMagicLink(broken())) blocked++
    expect(blocked).toBe(2)
  })
})

describe('sign-in email', () => {
  it('contains the link once as text, escapes it in HTML, and states the expiry', () => {
    const url = 'https://www.6figjobs.com/api/auth/callback/nodemailer?token=abc&email=a%40b.c"><script>'
    const mail = buildSignInEmail(url, 15)
    expect(mail.text).toContain(url)
    expect(mail.html).not.toContain('"><script>')
    expect(mail.html).toContain('&quot;&gt;&lt;script&gt;')
    expect(mail.text).toContain('15 minutes')
    expect(mail.subject).toBe('Your sign-in link for Six Figure Jobs')
  })
})

describe('sendSignInEmail', () => {
  const sendMail = jest.fn()
  beforeEach(() => {
    jest.resetModules()
    sendMail.mockReset()
    jest.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }))
  })
  const run = async () => {
    const { sendSignInEmail } = await import('@/lib/auth/email')
    return sendSignInEmail({ identifier: 'a@example.test', url: 'https://www.6figjobs.com/x?t=1', server: 'smtp://x', from: 'f@example.test', minutesValid: 15 })
  }

  it('resolves for a plain SMTP result that has no `pending` field (regression: spreading undefined threw)', async () => {
    sendMail.mockResolvedValue({ accepted: ['a@example.test'], rejected: [] })
    await expect(run()).resolves.toBeUndefined()
  })

  it('throws a generic error, with no address in it, when the server rejects the recipient', async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: ['a@example.test'], pending: [] })
    const err = await run().catch((e) => e)
    expect(err.message).toBe('sign-in email was not accepted')
  })
})

describe('callback path', () => {
  it.each([
    ['/account', '/account'],
    ['/pricing?x=1', '/pricing?x=1'],
    [undefined, '/account'],
    ['https://evil.test', '/account'],
    ['//evil.test', '/account'],
    ['/\\evil.test', '/account'],
    ['javascript:alert(1)', '/account'],
    ['/ok\nSet-Cookie: x', '/account'],
    [['/a', '/b'], '/a'],
  ])('%j -> %s', (input, expected) => {
    expect(safeCallbackPath(input as any)).toBe(expected)
  })
})

describe('session cookie', () => {
  it('is HttpOnly and SameSite=Lax, and Secure with the __Secure- prefix over https', () => {
    expect(sessionCookie(true)).toEqual({
      name: '__Secure-authjs.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
    })
    expect(sessionCookie(false).options).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false })
  })
})

describe('billing API same-origin check', () => {
  const env = { AUTH_URL: 'https://www.6figjobs.com' }
  const req = (origin?: string) =>
    new Request('https://www.6figjobs.com/api/billing/checkout', { method: 'POST', headers: origin ? { origin } : {} })
  it('accepts only the site origin', () => {
    expect(isSameOrigin(req('https://www.6figjobs.com'), env)).toBe(true)
    expect(isSameOrigin(req('https://evil.test'), env)).toBe(false)
    expect(isSameOrigin(req('https://www.6figjobs.com.evil.test'), env)).toBe(false)
    expect(isSameOrigin(req('http://www.6figjobs.com'), env)).toBe(false)
    expect(isSameOrigin(req(undefined), env)).toBe(false)
    expect(isSameOrigin(req('null'), env)).toBe(false)
  })
})
