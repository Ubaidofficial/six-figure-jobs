import { __clearMemoForTests } from '../../lib/cache/memo'
import { cachedXmlResponse } from '../../lib/seo/cachedSitemap'

const URLSET = '<?xml version="1.0"?><urlset><url><loc>https://www.6figjobs.com/a</loc></url></urlset>'
const EMPTY = '<?xml version="1.0"?><urlset></urlset>'
const xml = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'X-Test': 'kept' } })

beforeEach(() => __clearMemoForTests())

describe('cachedXmlResponse', () => {
  it('builds a good sitemap once and serves the repeat from memory, with its status and headers', async () => {
    const build = jest.fn(async () => xml(URLSET))
    const first = await cachedXmlResponse('t1', build)
    const second = await cachedXmlResponse('t1', build)
    expect(build).toHaveBeenCalledTimes(1)
    expect(await first.text()).toBe(URLSET)
    expect(await second.text()).toBe(URLSET)
    expect(second.status).toBe(200)
    expect(second.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    expect(second.headers.get('x-test')).toBe('kept')
  })

  it('also keeps a sitemap index (<sitemap> entries)', async () => {
    const build = jest.fn(async () => xml('<sitemapindex><sitemap><loc>https://www.6figjobs.com/x.xml</loc></sitemap></sitemapindex>'))
    await cachedXmlResponse('t2', build)
    await cachedXmlResponse('t2', build)
    expect(build).toHaveBeenCalledTimes(1)
  })

  it('never keeps an empty file, an error status or a fallback: the next request builds again', async () => {
    for (const [key, make] of [
      ['empty', () => xml(EMPTY)],
      ['404', () => xml('Not found', 404)],
      ['500', () => xml(URLSET, 500)],
    ] as const) {
      const build = jest.fn(async () => make())
      const first = await cachedXmlResponse(key, build)
      await cachedXmlResponse(key, build)
      expect(build).toHaveBeenCalledTimes(2)
      expect(first.status).toBe(key === 'empty' ? 200 : Number(key))
    }
  })

  it('returns the bad answer it built, body and status intact', async () => {
    const res = await cachedXmlResponse('bad', async () => xml('Not found', 404))
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not found')
  })

  it('builds the good answer after a bad one, and keeps that', async () => {
    let calls = 0
    const build = jest.fn(async () => (++calls === 1 ? xml(EMPTY) : xml(URLSET)))
    expect(await (await cachedXmlResponse('recover', build)).text()).toBe(EMPTY)
    expect(await (await cachedXmlResponse('recover', build)).text()).toBe(URLSET)
    await cachedXmlResponse('recover', build)
    expect(build).toHaveBeenCalledTimes(2)
  })

  it('keeps sitemaps apart by key', async () => {
    const a = jest.fn(async () => xml(URLSET))
    const b = jest.fn(async () => xml(URLSET))
    await cachedXmlResponse('one', a)
    await cachedXmlResponse('two', b)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})
