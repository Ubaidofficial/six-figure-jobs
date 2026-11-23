jest.mock('../../lib/jobs/jobAvailabilityCheck', () => ({ checkJobAvailability: jest.fn(async () => null) }))

import { NextRequest } from 'next/server'
import { config, proxy } from '../../proxy'
import { canonicalHostFor, getSiteUrl } from '../../lib/seo/site'

// The site moved from www.6figjobs.com to www.sixfigurejobs.net (2026-11-22). Page loads on any other host of ours must
// 301 to the same path on the canonical host; API calls (Stripe webhooks, cron, MCP) must keep answering on every host.
const UA = 'Mozilla/5.0 (Macintosh) Chrome/130.0 Safari/537.36'
const run = (host: string, path: string, method = 'GET') =>
  proxy(new NextRequest(`https://${host}${path}`, { method, headers: { host, 'user-agent': UA } }))
const redirected = (res: Response) => (res.status >= 300 && res.status < 400 ? res.headers.get('location') : null)

describe('canonical host', () => {
  const saved = { SITE_URL: process.env.SITE_URL, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL }
  beforeEach(() => {
    delete process.env.SITE_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
  })
  afterAll(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('defaults to https://www.sixfigurejobs.net', () => {
    expect(getSiteUrl()).toBe('https://www.sixfigurejobs.net')
  })

  it.each(['www.6figjobs.com', '6figjobs.com', 'sixfigurejobs.net', '6FIGJOBS.com:443'])('%s → canonical host', (host) => {
    expect(canonicalHostFor(host, 'www.sixfigurejobs.net')).toBe('www.sixfigurejobs.net')
  })

  it.each(['www.sixfigurejobs.net', 'localhost', 'six-figure-jobs:3000', 'example.com'])('%s is left alone', (host) => {
    expect(canonicalHostFor(host, 'www.sixfigurejobs.net')).toBeNull()
  })

  it.each([
    ['www.6figjobs.com', '/jobs/100k-plus?page=2'],
    ['6figjobs.com', '/'],
    ['sixfigurejobs.net', '/high-paying-jobs'],
  ])('a page on %s%s gets a 301 to the same path on www.sixfigurejobs.net', async (host, path) => {
    const res = await run(host, path)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(`https://www.sixfigurejobs.net${path}`)
  })

  it('HEAD requests are redirected too', async () => {
    expect(redirected(await run('www.6figjobs.com', '/jobs', 'HEAD'))).toBe('https://www.sixfigurejobs.net/jobs')
  })

  it.each([
    ['GET', '/api/health'],
    ['POST', '/api/billing/webhook'],
    ['POST', '/api/mcp'],
    ['POST', '/api/revalidate'],
  ])('%s %s on the old host is not redirected', async (method, path) => {
    expect(redirected(await run('www.6figjobs.com', path, method))).toBeNull()
  })

  // The matcher once skipped every .xml file, so www.6figjobs.com/sitemap.xml answered 200 with the new domain's URLs
  // (2026-11-23). Sitemaps must reach the proxy; images, .txt key files and .json must not.
  it('the proxy runs on .xml files but not on other static files', () => {
    const inner = config.matcher[0].slice(1)
    const runsOn = (path: string) => new RegExp(`^/${inner}$`).test(path)
    for (const path of ['/sitemap.xml', '/sitemap-hubs.xml', '/feed.xml', '/jobs']) expect([path, runsOn(path)]).toEqual([path, true])
    for (const path of ['/icon1.png', '/b2700620b9ead52c521249c2c119fe2a.txt', '/robots.txt', '/manifest.json', '/favicon.ico']) expect([path, runsOn(path)]).toEqual([path, false])
  })

  it.each(['/sitemap.xml', '/sitemap-hubs.xml'])('%s on the old host gets a 301 to the new host', async (path) => {
    const res = await run('www.6figjobs.com', path)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(`https://www.sixfigurejobs.net${path}`)
    expect(redirected(await run('www.sixfigurejobs.net', path))).toBeNull()
  })

  it('pages on the canonical host are served as is', async () => {
    expect(redirected(await run('www.sixfigurejobs.net', '/jobs'))).toBeNull()
  })

  it('follows SITE_URL when it is set', async () => {
    process.env.SITE_URL = 'https://www.6figjobs.com'
    expect(redirected(await run('www.6figjobs.com', '/jobs'))).toBeNull()
    expect(redirected(await run('www.sixfigurejobs.net', '/jobs'))).toBe('https://www.6figjobs.com/jobs')
  })
})
