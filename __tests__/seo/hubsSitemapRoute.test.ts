// The routes read getSiteUrl() once, when they are imported, and getSiteUrl() prefers SITE_URL, which CI sets to
// http://localhost:3000 for its server step. So the URL is pinned before the routes are imported, not in a hook that
// runs after them.
const originalSiteUrl = process.env.SITE_URL
let getHubs: typeof import('../../app/sitemap-hubs.xml/route').GET
let getIndex: typeof import('../../app/sitemap.xml/route').GET

beforeAll(async () => {
  process.env.SITE_URL = 'https://www.6figjobs.com'
  jest.resetModules()
  ;({ GET: getHubs } = await import('../../app/sitemap-hubs.xml/route'))
  ;({ GET: getIndex } = await import('../../app/sitemap.xml/route'))
})

afterAll(() => {
  if (originalSiteUrl === undefined) delete process.env.SITE_URL
  else process.env.SITE_URL = originalSiteUrl
})

const aggregate = jest.fn()
jest.mock('../../lib/prisma', () => ({ prisma: { job: { aggregate: (...a: unknown[]) => aggregate(...a) } } }))

describe('sitemap routes', () => {
  beforeEach(() => {
    aggregate.mockReset()
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.6figjobs.com'
    process.env.INDEXING_PHASE = '1'
  })

  it('index: lastmod is the newest job update, never the request time', async () => {
    aggregate.mockResolvedValue({ _max: { updatedAt: new Date('2026-01-02T03:04:05.000Z') } })
    const xml = await (await getIndex()).text()
    expect(xml).toContain('<lastmod>2026-01-02T03:04:05.000Z</lastmod>')
    expect(xml).not.toContain(String(new Date().getUTCFullYear() + 1))
  })

  it('index: omits lastmod instead of inventing one when the database is down', async () => {
    aggregate.mockRejectedValue(new Error('db down'))
    const xml = await (await getIndex()).text()
    expect(xml).toContain('<loc>https://www.6figjobs.com/sitemap-hubs.xml</loc>')
    expect(xml).not.toContain('<lastmod>')
  })

  it('hubs: well-formed urlset with absolute URLs, the homepage without a trailing slash, and no duplicates', async () => {
    aggregate.mockRejectedValue(new Error('db down'))
    const res = await getHubs()
    expect(res.headers.get('content-type')).toContain('application/xml')
    const xml = await res.text()
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs).toContain('https://www.6figjobs.com')
    expect(locs).toContain('https://www.6figjobs.com/jobs')
    expect(locs.every((l) => l.startsWith('https://www.6figjobs.com'))).toBe(true)
    expect(new Set(locs).size).toBe(locs.length)
  })
})
