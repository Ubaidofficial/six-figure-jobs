/**
 * @jest-environment node
 */
// Admin console: error grouping and noise (lib/admin/errorReports.ts), the public error endpoint's limits, and the
// config API that may now write sponsor slots only.
import { browserFamily, errorGroupKey, errorPagePath, groupErrorReports, isNoiseError } from '../../lib/admin/errorReports'

const create = jest.fn(async () => ({}))
const upsert = jest.fn((args: unknown) => args)
const transaction = jest.fn(async (ops: unknown[]) => ops)
jest.mock('../../lib/prisma', () => ({
  prisma: {
    errorLog: { create: (...a: unknown[]) => create(...(a as [])) },
    siteConfig: { upsert: (a: unknown) => upsert(a) },
    $transaction: (ops: unknown[]) => transaction(ops),
  },
}))
let admin = true
jest.mock('../../lib/admin/auth', () => ({ getAdminSession: async () => admin }))

const CHROME = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
const EDGE = `${CHROME} Edg/131.0`
const SAFARI = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

describe('error noise', () => {
  it('treats the ResizeObserver warning, bare cross-origin errors and extension stacks as noise', () => {
    expect(isNoiseError('ResizeObserver loop completed with undelivered notifications.')).toBe(true)
    expect(isNoiseError('ResizeObserver loop limit exceeded')).toBe(true)
    expect(isNoiseError('Script error.')).toBe(true)
    expect(isNoiseError('x is undefined', 'at f (chrome-extension://abc/content.js:1:2)')).toBe(true)
    expect(isNoiseError('x is undefined', null, 'moz-extension://abc/x.js')).toBe(true)
  })
  it('keeps real errors, including ones that mention a third-party name', () => {
    expect(isNoiseError("Unhandled promise rejection: Cannot read properties of undefined (reading 'M_ID')")).toBe(false)
    expect(isNoiseError('Script error in checkout')).toBe(false)
  })
})

describe('error grouping', () => {
  it('ignores long numbers in the key, not the words', () => {
    expect(errorGroupKey('Chunk 4821 failed')).toBe(errorGroupKey('Chunk 9917 failed'))
    expect(errorGroupKey('a is undefined')).not.toBe(errorGroupKey('b is undefined'))
  })

  it('reads the page path and a browser name', () => {
    expect(errorPagePath('https://www.sixfigurejobs.net/jobs?q=Finance+Manager&exact=1')).toBe('/jobs')
    expect(errorPagePath(null)).toBe('(unknown page)')
    expect(browserFamily(EDGE)).toBe('Edge')
    expect(browserFamily(CHROME)).toBe('Chrome')
    expect(browserFamily(SAFARI)).toBe('Safari')
  })

  it('folds repeated reports into one issue with counts, pages, browsers and first/last seen', () => {
    const at = (h: number) => new Date(Date.UTC(2026, 10, 23, h))
    const msg = "Unhandled promise rejection: Cannot read properties of undefined (reading 'M_ID')"
    const rows = [
      { id: '1', message: msg, stack: 's1', url: 'https://x.test/jobs?q=a', userAgent: CHROME, status: 'new', createdAt: at(10) },
      { id: '2', message: msg, stack: 's2', url: 'https://x.test/jobs?q=b', userAgent: SAFARI, status: 'new', createdAt: at(12) },
      { id: '3', message: msg, stack: null, url: 'https://x.test/remote', userAgent: CHROME, status: 'resolved', createdAt: at(8) },
      { id: '4', message: 'ResizeObserver loop completed with undelivered notifications.', stack: null, url: 'https://x.test/ubaid93', userAgent: CHROME, status: 'new', createdAt: at(11) },
    ]
    const groups = groupErrorReports(rows)
    expect(groups).toHaveLength(2)
    const g = groups[0]
    expect(g.message).toBe(msg)
    expect([g.count, g.newCount]).toEqual([3, 2])
    expect(g.firstSeen).toEqual(at(8))
    expect(g.lastSeen).toEqual(at(12))
    expect(g.latestStack).toBe('s2')
    expect(g.pages).toEqual([{ path: '/jobs', count: 2 }, { path: '/remote', count: 1 }])
    expect(g.browsers).toEqual([{ name: 'Chrome', count: 2 }, { name: 'Safari', count: 1 }])
    expect(g.noise).toBe(false)
    expect(groups[1].noise).toBe(true)
  })
})

describe('POST /api/log-error', () => {
  const post = (body: unknown, ip: string) =>
    new Request('https://www.sixfigurejobs.net/api/log-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, 'user-agent': CHROME },
      body: JSON.stringify(body),
    })

  beforeEach(() => create.mockClear())

  it('drops noise without storing it', async () => {
    const { POST } = await import('../../app/api/log-error/route')
    const res = await POST(post({ message: 'ResizeObserver loop completed with undelivered notifications.' }, '9.9.9.1'))
    expect(await res.json()).toEqual({ ok: true, stored: false })
    expect(create).not.toHaveBeenCalled()
  })

  it('stores at most 20 reports from one client in 10 minutes', async () => {
    const { POST } = await import('../../app/api/log-error/route')
    for (let i = 0; i < 25; i++) await POST(post({ message: `TypeError: a${i} is not a function` }, '9.9.9.2'))
    expect(create).toHaveBeenCalledTimes(20)
    await POST(post({ message: 'TypeError: other client' }, '9.9.9.3'))
    expect(create).toHaveBeenCalledTimes(21)
  })

  it('stores one error at most 100 times an hour across clients', async () => {
    const { POST } = await import('../../app/api/log-error/route')
    for (let i = 0; i < 110; i++) await POST(post({ message: 'TypeError: loop on a popular page' }, `10.0.${Math.floor(i / 10)}.${i}`))
    expect(create).toHaveBeenCalledTimes(100)
  })
})

describe('POST /api/ubaid93/config', () => {
  const post = (body: unknown) =>
    new Request('https://www.sixfigurejobs.net/api/ubaid93/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    upsert.mockClear()
    admin = true
  })

  it('saves sponsor slot fields together', async () => {
    const { POST } = await import('../../app/api/ubaid93/config/route')
    const res = await POST(post({ values: { 'sponsor.1.name': ' Acme ', 'sponsor.1.until': '2026-12-31' } }))
    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert.mock.calls[0][0]).toMatchObject({ where: { key: 'sponsor.1.name' }, update: { value: 'Acme' } })
  })

  it('refuses any other key, such as the freehire change-feed cursor', async () => {
    const { POST } = await import('../../app/api/ubaid93/config/route')
    const res = await POST(post({ values: { 'sponsor.1.name': 'Acme', 'freehire.changes.cursor': 'x' } }))
    expect(res.status).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('needs an admin session', async () => {
    admin = false
    const { POST } = await import('../../app/api/ubaid93/config/route')
    expect((await POST(post({ values: { 'sponsor.1.name': 'Acme' } }))).status).toBe(401)
  })
})
