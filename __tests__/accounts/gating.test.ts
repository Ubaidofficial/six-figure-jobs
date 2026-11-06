// With ACCOUNTS_ENABLED unset (the default) every new route and page must be unreachable, and nothing may load next-auth,
// Stripe or the database. These tests drive the real route and page modules with the flag off.

import {
  accountsEnabled,
  billingEnabled,
  emailConfigured,
  googleConfigured,
  webhookEnabled,
} from '@/lib/accounts/enabled'

const OFF_VARIANTS: Record<string, string>[] = [
  {},
  { ACCOUNTS_ENABLED: 'false', AUTH_SECRET: 's', STRIPE_SECRET_KEY: 'k', STRIPE_WEBHOOK_SECRET: 'w' },
  { ACCOUNTS_ENABLED: '', AUTH_SECRET: 's' },
  { ACCOUNTS_ENABLED: '1', AUTH_SECRET: 's' },
  { ACCOUNTS_ENABLED: 'true' }, // flag without AUTH_SECRET
  { STRIPE_SECRET_KEY: 'k', STRIPE_WEBHOOK_SECRET: 'w', AUTH_SECRET: 's' }, // keys without the flag
]

describe('env gate', () => {
  it.each(OFF_VARIANTS)('is off for %j', (env) => {
    expect(accountsEnabled(env)).toBe(false)
    expect(billingEnabled(env)).toBe(false)
    expect(webhookEnabled(env)).toBe(false)
  })

  it('turns on in layers: accounts, then billing, then the webhook', () => {
    const base = { ACCOUNTS_ENABLED: 'true', AUTH_SECRET: 's', NODE_ENV: 'development' }
    expect(accountsEnabled(base)).toBe(true)
    expect(billingEnabled(base)).toBe(false)
    expect(billingEnabled({ ...base, STRIPE_SECRET_KEY: 'k' })).toBe(true)
    expect(webhookEnabled({ ...base, STRIPE_SECRET_KEY: 'k' })).toBe(false)
    expect(webhookEnabled({ ...base, STRIPE_SECRET_KEY: 'k', STRIPE_WEBHOOK_SECRET: 'w' })).toBe(true)
  })

  it('accepts "TRUE" and surrounding spaces, and treats blank secrets as unset', () => {
    expect(accountsEnabled({ ACCOUNTS_ENABLED: ' TRUE ', AUTH_SECRET: 's', NODE_ENV: 'development' })).toBe(true)
    expect(accountsEnabled({ ACCOUNTS_ENABLED: 'true', AUTH_SECRET: '  ', NODE_ENV: 'development' })).toBe(false)
  })

  it('in production also requires AUTH_URL, so a forged Host header cannot steer sign-in links', () => {
    const prod = { ACCOUNTS_ENABLED: 'true', AUTH_SECRET: 's', NODE_ENV: 'production' }
    expect(accountsEnabled(prod)).toBe(false)
    expect(accountsEnabled({ ...prod, AUTH_URL: 'https://www.6figjobs.com' })).toBe(true)
  })

  it('knows which sign-in methods are configured', () => {
    expect(googleConfigured({ AUTH_GOOGLE_ID: 'a' })).toBe(false)
    expect(googleConfigured({ AUTH_GOOGLE_ID: 'a', AUTH_GOOGLE_SECRET: 'b' })).toBe(true)
    expect(emailConfigured({ EMAIL_SERVER: 'smtp://x' })).toBe(false)
    expect(emailConfigured({ EMAIL_SERVER: 'smtp://x', EMAIL_FROM: 'a@b.c' })).toBe(true)
  })
})

describe('routes answer 404 when disabled', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    for (const k of ['ACCOUNTS_ENABLED', 'AUTH_SECRET', 'AUTH_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) delete process.env[k]
  })
  afterAll(() => {
    process.env = saved
  })

  const modules = {
    auth: () => import('@/app/api/auth/[...nextauth]/route'),
    checkout: () => import('@/app/api/billing/checkout/route'),
    portal: () => import('@/app/api/billing/portal/route'),
    webhook: () => import('@/app/api/billing/webhook/route'),
  }

  for (const [name, load] of Object.entries(modules)) {
    it(`${name}: every exported method is a plain 404`, async () => {
      const mod: Record<string, (req: Request) => Promise<Response> | Response> = (await load()) as any
      const methods = Object.keys(mod).filter((k) => /^[A-Z]+$/.test(k))
      expect(methods.sort()).toEqual(expect.arrayContaining(['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']))
      for (const method of methods) {
        const res = await mod[method](
          new Request('https://www.6figjobs.com/api/x', { method: method === 'GET' ? 'GET' : 'POST', body: method === 'GET' ? undefined : '{}' }),
        )
        expect({ method, status: res.status }).toEqual({ method, status: 404 })
        expect(res.headers.get('cache-control')).toBe('no-store')
      }
    })
  }

  it('the webhook is 404 with accounts on but no webhook secret, and does no work', async () => {
    Object.assign(process.env, { ACCOUNTS_ENABLED: 'true', AUTH_SECRET: 's', AUTH_URL: 'https://x.test', STRIPE_SECRET_KEY: 'k' })
    const { POST } = await modules.webhook()
    const res = await POST(new Request('https://x.test/api/billing/webhook', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(404)
  })
})

describe('pages are not found when disabled', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    jest.resetModules()
    for (const k of ['ACCOUNTS_ENABLED', 'AUTH_SECRET', 'AUTH_URL', 'STRIPE_SECRET_KEY']) delete process.env[k]
    // The view modules pull in CSS modules and client code; the gate must fire before any of them matter.
    jest.doMock('next/navigation', () => ({
      notFound: () => {
        throw new Error('NEXT_NOT_FOUND')
      },
      redirect: (to: string) => {
        throw new Error(`NEXT_REDIRECT:${to}`)
      },
    }))
    jest.doMock('next/server', () => ({ connection: async () => undefined }))
    for (const m of [
      '@/components/account/account.module.css',
      '@/components/account/SignInForm',
      '@/components/account/AccountView',
      '@/components/account/PlansView',
      '@/lib/auth/session',
      '@/lib/billing/summary',
    ]) {
      jest.doMock(m, () => ({}))
    }
  })
  afterAll(() => {
    process.env = saved
    jest.dontMock('next/navigation')
  })

  it('/sign-in', async () => {
    const { default: Page } = await import('@/app/sign-in/page')
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('/account', async () => {
    const { default: Page } = await import('@/app/account/page')
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('/pricing keeps its redirect to /jobs and does not wait on the request', async () => {
    const { default: Page } = await import('@/app/pricing/page')
    await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/jobs')
  })
})
