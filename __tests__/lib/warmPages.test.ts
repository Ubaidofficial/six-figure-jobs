import { REWARM_EVERY_MS, WARM_PATHS, WARM_USER_AGENT, hubPaths, sitemapPaths, warmPages } from '../../lib/runtime/warmPages'
import { DEFAULT_TTL_MS, MAX_STALE_MS } from '../../lib/cache/memo'

const ok = () => ({ status: 200, arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response
const noWait = async () => {}

describe('warmPages (after a deploy)', () => {
  it('requests each page once, one at a time, as itself', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const seen: string[] = []
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      seen.push(url)
      expect((init?.headers as Record<string, string>)['user-agent']).toBe(WARM_USER_AGENT)
      await new Promise((r) => setTimeout(r, 1))
      inFlight--
      return ok()
    })
    const results = await warmPages('http://127.0.0.1:3000', WARM_PATHS, fetchImpl, noWait)
    expect(maxInFlight).toBe(1)
    expect(seen).toEqual(WARM_PATHS.map((p) => `http://127.0.0.1:3000${p}`))
    expect(results.every((r) => r.status === 200)).toBe(true)
  })

  it('retries the first page while the server starts listening, then carries on', async () => {
    let calls = 0
    const fetchImpl = jest.fn(async () => {
      calls++
      if (calls <= 2) throw new Error('ECONNREFUSED')
      return ok()
    })
    const results = await warmPages('http://x', ['/', '/jobs'], fetchImpl, noWait)
    expect(results.map((r) => r.status)).toEqual([200, 200])
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('never throws: a page that fails is reported and skipped', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      if (url.endsWith('/jobs')) throw new Error('timeout')
      return ok()
    })
    const results = await warmPages('http://x', ['/', '/jobs', '/remote'], fetchImpl, noWait)
    expect(results.map((r) => r.status)).toEqual([200, null, 200])
  })
})

describe('keeping hub pages warm', () => {
  const xml = (urls: string[], tag = 'url') =>
    `<?xml version="1.0"?><root>${urls.map((u) => `<${tag}><loc>${u}</loc></${tag}>`).join('')}</root>`
  const text = (body: string, status = 200) => ({ status, text: async () => body }) as unknown as Response

  it('re-warms well inside the window a cache entry is still served', () => {
    expect(REWARM_EVERY_MS).toBeLessThan(DEFAULT_TTL_MS + MAX_STALE_MS)
  })

  it('reads paths from a sitemap: the homepage as "/", duplicates once', () => {
    expect(
      sitemapPaths(xml(['https://www.6figjobs.com', 'https://www.6figjobs.com/jobs', ' https://www.6figjobs.com/jobs ', 'not a url'])),
    ).toEqual(['/', '/jobs'])
  })

  it('lists the hub sitemaps\' pages, never the job or company sitemaps', async () => {
    const site = 'https://www.6figjobs.com'
    const bodies: Record<string, Response> = {
      '/sitemap.xml': text(
        xml([`${site}/sitemap-hubs.xml`, `${site}/sitemap-salary.xml`, `${site}/sitemap-jobs/1`, `${site}/sitemap-company/1`], 'sitemap'),
      ),
      '/sitemap-hubs.xml': text(xml([site, `${site}/jobs`, `${site}/jobs/100k-plus`])),
      '/sitemap-salary.xml': text(xml([`${site}/salary`, `${site}/jobs`])),
    }
    const asked: string[] = []
    const fetchImpl = jest.fn(async (url: string) => {
      const path = new URL(url).pathname
      asked.push(path)
      return bodies[path] ?? text('', 404)
    })
    expect(await hubPaths('http://127.0.0.1:3000', fetchImpl)).toEqual(['/', '/jobs', '/jobs/100k-plus', '/salary'])
    expect(asked).toEqual(['/sitemap.xml', '/sitemap-hubs.xml', '/sitemap-salary.xml'])
  })

  it('never throws when the sitemaps fail', async () => {
    expect(await hubPaths('http://x', async () => Promise.reject(new Error('down')))).toEqual([])
  })

  it('pauses between pages when asked, not before the first', async () => {
    const waits: number[] = []
    const fetchImpl = jest.fn(async () => ({ status: 200, arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response)
    await warmPages('http://x', ['/a', '/b', '/c'], fetchImpl, async (ms) => void waits.push(ms), 2000)
    expect(waits).toEqual([2000, 2000])
  })
})
