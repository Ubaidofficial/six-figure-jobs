// The routes read getSiteUrl() once, when they are imported, and getSiteUrl() prefers SITE_URL, which CI sets to
// http://localhost:3000 for its server step. So the URL is pinned before the routes are imported, not in a hook that
// runs after them.
const originalSiteUrl = process.env.SITE_URL
let getHubs: typeof import('../../app/sitemap-hubs.xml/route').GET
let getIndex: typeof import('../../app/sitemap.xml/route').GET
let clearMemo: () => void

beforeAll(async () => {
  process.env.SITE_URL = 'https://www.6figjobs.com'
  jest.resetModules()
  ;({ GET: getHubs } = await import('../../app/sitemap-hubs.xml/route'))
  ;({ GET: getIndex } = await import('../../app/sitemap.xml/route'))
  // The same module instance the routes use (imported after resetModules): the hubs entries are cached in it.
  ;({ __clearMemoForTests: clearMemo } = await import('../../lib/cache/memo'))
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
    clearMemo()
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.6figjobs.com'
    process.env.INDEXING_PHASE = '1'
  })

  it('index: a child is dated by its own newest entry, as a day, never a clock time or the request time', async () => {
    aggregate.mockResolvedValue({ _max: { createdAt: new Date('2026-01-02T03:04:05.000Z') } })
    const index = await (await getIndex()).text()
    const hubs = await (await getHubs()).text()
    const { newestLastmod } = await import('../../lib/seo/lastmod')
    expect(index).toContain(`<loc>https://www.6figjobs.com/sitemap-hubs.xml</loc>\n    <lastmod>${newestLastmod(hubs)}</lastmod>`)
    expect(index).not.toMatch(/<lastmod>[^<]*T[^<]*<\/lastmod>/) // days only
    expect(index).not.toContain(String(new Date().getUTCFullYear() + 1))
  })

  it('index: leaves the date out of a child it cannot read, instead of lending it another page\'s', async () => {
    aggregate.mockRejectedValue(new Error('db down'))
    const xml = await (await getIndex()).text()
    expect(xml).toContain('<loc>https://www.6figjobs.com/sitemap-hubs.xml</loc>')
    // The salary file needs the database: with it down there is nothing to date it by.
    expect(xml).toMatch(/<loc>https:\/\/www\.6figjobs\.com\/sitemap-salary\.xml<\/loc>\s*<\/sitemap>/)
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

  describe('a database failure part-way through', () => {
    const live = { _count: { _all: 5 }, _max: { createdAt: new Date('2026-01-02T03:04:05.000Z') } }
    const locsOf = async () => [...(await (await getHubs()).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    const evergreen = () => import('../../lib/seo/evergreenSitemap')

    beforeEach(async () => (await evergreen()).__resetEvergreenSitemapCacheForTests())
    afterEach(() => jest.restoreAllMocks())

    it('does not keep the partial list: the next request with the database back lists the role pages', async () => {
      // Pillars read fine, every role count fails: the list is partial.
      aggregate.mockImplementation(async ({ _count }: { _count?: unknown }) => {
        if (_count) throw new Error('could not resize shared memory segment')
        return live
      })
      const partial = await locsOf()
      expect(partial).toContain('https://www.6figjobs.com/jobs')
      expect(partial).not.toContain('https://www.6figjobs.com/salary/software-engineer')

      aggregate.mockReset()
      aggregate.mockResolvedValue(live)
      const full = await locsOf()
      expect(full).toContain('https://www.6figjobs.com/jobs/software-engineer')
      expect(full).toContain('https://www.6figjobs.com/salary/software-engineer')
    })

    it('keeps serving the last complete list while a refresh comes back partial', async () => {
      const start = Date.now()
      const now = jest.spyOn(Date, 'now').mockReturnValue(start)
      aggregate.mockResolvedValue(live)
      expect(await locsOf()).toContain('https://www.6figjobs.com/salary/software-engineer')

      // Past both caches' freshness (30 minutes here, an hour in lib/seo/evergreenSitemap.ts) with the role counts failing.
      now.mockReturnValue(start + 61 * 60 * 1000)
      aggregate.mockReset()
      aggregate.mockImplementation(async ({ _count }: { _count?: unknown }) => {
        if (_count) throw new Error('could not resize shared memory segment')
        return live
      })
      expect(await locsOf()).toContain('https://www.6figjobs.com/salary/software-engineer')
      await new Promise((resolve) => setImmediate(resolve)) // the failed background refresh settles
      expect(await locsOf()).toContain('https://www.6figjobs.com/salary/software-engineer')
    })
  })
})
