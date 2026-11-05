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
  const original = process.env.LOGODEV_API_KEY
  afterEach(() => {
    if (original === undefined) delete process.env.LOGODEV_API_KEY
    else process.env.LOGODEV_API_KEY = original
  })
  const call = (kind: string, value: string) =>
    GET(new Request('http://localhost/logo'), { params: Promise.resolve({ kind, value }) })

  it('redirects to logo.dev with the server key and caches the redirect', async () => {
    process.env.LOGODEV_API_KEY = 'pk_server'
    const res = await call('domain', 'stripe.com')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://img.logo.dev/stripe.com?token=pk_server&size=128&format=webp')
    expect(res.headers.get('cache-control')).toContain('s-maxage')
  })

  it('decodes names and can only ever redirect to img.logo.dev', async () => {
    process.env.LOGODEV_API_KEY = 'pk_server'
    const res = await call('name', 'Acme%20Labs')
    expect(new URL(res.headers.get('location')!).host).toBe('img.logo.dev')
    const evil = await call('domain', 'evil.com%2F..%2F@x.com')
    expect(evil.status).toBe(404)
  })

  it('returns 404 when no key is configured or the kind is unknown', async () => {
    delete process.env.LOGODEV_API_KEY
    expect((await call('domain', 'stripe.com')).status).toBe(404)
    process.env.LOGODEV_API_KEY = 'pk_server'
    expect((await call('ticker', 'SHOP')).status).toBe(404)
  })
})

describe('logoProxyUrl', () => {
  it('encodes names', () => {
    expect(logoProxyUrl('name', 'A & B')).toBe('/logo/name/A%20%26%20B')
  })
})
