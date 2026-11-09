import { buildLogoDevUrl, buildLogoUrl, logoProxyUrl } from '../../lib/companies/logo'
import { GET } from '../../app/logo/[kind]/[value]/route'

describe('buildLogoUrl', () => {
  const original = process.env.LOGODEV_API_KEY
  afterEach(() => {
    if (original === undefined) delete process.env.LOGODEV_API_KEY
    else process.env.LOGODEV_API_KEY = original
  })

  it('builds the same URL with and without the key, so server and browser agree (hydration)', () => {
    process.env.LOGODEV_API_KEY = 'pk_test'
    const onServer = buildLogoUrl(null, 'https://www.stripe.com/jobs', 'Stripe')
    delete process.env.LOGODEV_API_KEY
    const inBrowser = buildLogoUrl(null, 'https://www.stripe.com/jobs', 'Stripe')
    expect(onServer).toBe('/logo/domain/stripe.com')
    expect(inBrowser).toBe(onServer)
  })

  it('never puts the key in a website- or name-derived URL', () => {
    process.env.LOGODEV_API_KEY = 'pk_secret_value'
    expect(buildLogoUrl(null, 'ramp.com', 'Ramp')).not.toContain('pk_secret_value')
    expect(buildLogoUrl(null, null, 'Ramp')).not.toContain('pk_secret_value')
  })

  it('keeps a stored logo.dev URL and adds size and format', () => {
    const out = buildLogoUrl('https://img.logo.dev/notion.so?token=pk_x', 'https://ignored.example', 'Notion')!
    expect(out).toContain('img.logo.dev/notion.so')
    expect(out).toContain('size=64')
    expect(out).toContain('format=webp')
  })

  it('replaces a stored Clearbit URL with logo.dev for the same domain', () => {
    expect(buildLogoUrl('https://logo.clearbit.com/figma.com', null, 'Figma')).toBe('/logo/domain/figma.com')
  })

  it('prefers logo.dev for the website over a stored third-party image, and keeps the image if there is no website', () => {
    const cdn = 'https://cdn.builtin.com/logo.png'
    expect(buildLogoUrl(cdn, 'https://linear.app', 'Linear')).toBe('/logo/domain/linear.app')
    expect(buildLogoUrl(cdn, null, 'Linear')).toBe(cdn)
  })

  it('falls back to a name lookup only when there is no usable website or stored logo', () => {
    expect(buildLogoUrl(null, null, 'Acme Labs')).toBe('/logo/name/Acme%20Labs')
    expect(buildLogoUrl(null, 'https://www.linkedin.com/company/acme', 'Acme Labs')).toBe('/logo/name/Acme%20Labs')
  })

  it('returns null with nothing to go on', () => {
    expect(buildLogoUrl(null, null, null)).toBeNull()
    expect(buildLogoUrl(null, null, '   ')).toBeNull()
    expect(buildLogoUrl(null, null, 'x'.repeat(200))).toBeNull()
  })
})

describe('buildLogoDevUrl', () => {
  it('builds logo.dev URLs for a domain and a name', () => {
    expect(buildLogoDevUrl('domain', 'Stripe.com', 'pk_t')).toBe('https://img.logo.dev/stripe.com?token=pk_t&size=128&format=webp')
    expect(buildLogoDevUrl('name', 'Acme Labs', 'pk_t')).toBe('https://img.logo.dev/name/Acme%20Labs?token=pk_t&size=128&format=webp')
  })

  it('rejects anything that is not a plain domain or a short name', () => {
    for (const bad of ['evil.com/../x', 'a b.com', 'http://evil.com', 'localhost', 'x.com?token=1', '']) {
      expect(buildLogoDevUrl('domain', bad, 'pk_t')).toBeNull()
    }
    expect(buildLogoDevUrl('name', '', 'pk_t')).toBeNull()
    expect(buildLogoDevUrl('name', 'x'.repeat(81), 'pk_t')).toBeNull()
    expect(buildLogoDevUrl('other', 'stripe.com', 'pk_t')).toBeNull()
  })

  it('returns null without a key', () => {
    expect(buildLogoDevUrl('domain', 'stripe.com', '  ')).toBeNull()
  })
})

describe('GET /logo/[kind]/[value]', () => {
  const originalKey = process.env.LOGODEV_API_KEY
  const originalFetch = global.fetch
  afterEach(() => {
    if (originalKey === undefined) delete process.env.LOGODEV_API_KEY
    else process.env.LOGODEV_API_KEY = originalKey
    global.fetch = originalFetch
  })

  const image = (ok: boolean) =>
    ({ ok, status: ok ? 200 : 404, headers: new Headers({ 'content-type': ok ? 'image/webp' : 'text/plain' }), body: null }) as unknown as Response
  const mockFetch = (...answers: boolean[]) => {
    const fn = jest.fn()
    answers.forEach((ok) => fn.mockResolvedValueOnce(image(ok)))
    global.fetch = fn as unknown as typeof fetch
    return fn
  }
  // Each test uses its own domain: the route remembers answers in memory.
  const call = (kind: string, value: string) =>
    GET(new Request('http://localhost/logo'), { params: Promise.resolve({ kind, value }) })

  it('redirects to logo.dev (strict) when it has the logo, and caches the redirect', async () => {
    process.env.LOGODEV_API_KEY = 'pk_server'
    mockFetch(true)
    const res = await call('domain', 'has-logo.com')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(
      'https://img.logo.dev/has-logo.com?token=pk_server&size=128&format=webp&fallback=404',
    )
    expect(res.headers.get('cache-control')).toContain('s-maxage')
  })

  it('falls back to the free icon.horse when logo.dev has no logo', async () => {
    process.env.LOGODEV_API_KEY = 'pk_server'
    mockFetch(false)
    const res = await call('domain', 'no-logodev.com')
    expect(res.headers.get('location')).toBe('https://icon.horse/icon/no-logodev.com')
  })

  it('works with no logo.dev key at all, using icon.horse without probing', async () => {
    delete process.env.LOGODEV_API_KEY
    const fn = mockFetch()
    const res = await call('domain', 'free-only.com')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://icon.horse/icon/free-only.com')
    expect(fn).not.toHaveBeenCalled()
  })

  it('probes once per domain and remembers the answer', async () => {
    process.env.LOGODEV_API_KEY = 'pk_server'
    const fn = mockFetch(true)
    await call('domain', 'remembered.com')
    await call('domain', 'remembered.com')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('uses the fallback when logo.dev does not answer (timeout, network), but only briefly', async () => {
    process.env.LOGODEV_API_KEY = 'pk_server'
    const fn = jest.fn().mockRejectedValue(new Error('timeout'))
    global.fetch = fn as unknown as typeof fetch
    const res = await call('domain', 'times-out.com')
    expect(res.headers.get('location')).toBe('https://icon.horse/icon/times-out.com')
    expect(res.headers.get('cache-control')).toBe('public, max-age=300')
  })

  it('does not remember a fallback chosen because logo.dev was rate-limiting, and asks again', async () => {
    process.env.LOGODEV_API_KEY = 'pk_server'
    const limited = { ok: false, status: 429, headers: new Headers(), body: null } as unknown as Response
    const fn = jest.fn().mockResolvedValueOnce(limited).mockResolvedValueOnce(image(true))
    global.fetch = fn as unknown as typeof fetch
    const nowSpy = jest.spyOn(Date, 'now')
    nowSpy.mockReturnValue(1_000_000)
    const first = await call('domain', 'rate-limited.com')
    expect(first.headers.get('location')).toBe('https://icon.horse/icon/rate-limited.com')
    expect(first.headers.get('cache-control')).toBe('public, max-age=300')
    // Six minutes later logo.dev answers, and its logo is used and remembered.
    nowSpy.mockReturnValue(1_000_000 + 6 * 60 * 1000)
    const second = await call('domain', 'rate-limited.com')
    expect(second.headers.get('location')).toContain('https://img.logo.dev/rate-limited.com')
    expect(second.headers.get('cache-control')).toContain('s-maxage')
    expect(fn).toHaveBeenCalledTimes(2)
    nowSpy.mockRestore()
  })

  it('remembers a settled "no logo" from logo.dev for the day', async () => {
    process.env.LOGODEV_API_KEY = 'pk_server'
    const fn = mockFetch(false)
    const res = await call('domain', 'settled-none.com')
    expect(res.headers.get('cache-control')).toContain('s-maxage')
    await call('domain', 'settled-none.com')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('decodes names and can only ever redirect to a fixed logo host', async () => {
    process.env.LOGODEV_API_KEY = 'pk_server'
    const res = await call('name', 'Acme%20Labs')
    expect(new URL(res.headers.get('location')!).host).toBe('img.logo.dev')
    expect((await call('domain', 'evil.com%2F..%2F@x.com')).status).toBe(404)
  })

  it('returns 404 for names without a key and for unknown kinds', async () => {
    delete process.env.LOGODEV_API_KEY
    expect((await call('name', 'No Key Inc')).status).toBe(404)
    process.env.LOGODEV_API_KEY = 'pk_server'
    expect((await call('ticker', 'SHOP')).status).toBe(404)
  })
})

describe('logoProxyUrl', () => {
  it('encodes names', () => {
    expect(logoProxyUrl('name', 'A & B')).toBe('/logo/name/A%20%26%20B')
  })
})
