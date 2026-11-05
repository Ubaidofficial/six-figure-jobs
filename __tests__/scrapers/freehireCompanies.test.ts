import { loadFreehireCompanyWebsites, mapFreehireJob, type FreehireJob } from '../../lib/scrapers/freehire'

jest.mock('../../lib/jobs/ingestBoardJob', () => ({ ingestBoardJob: jest.fn() }))

function res(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return { status, ok: status >= 200 && status < 300, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null }, json: async () => body } as unknown as Response
}
const company = (website: unknown) => res(200, { data: { company: { company_info: { website } } } })

describe('loadFreehireCompanyWebsites', () => {
  it('returns the real company websites and skips boards, missing sites, 404s and network errors', async () => {
    const fetchFn = jest.fn(async (url: string) => {
      if (url.endsWith('/stripe')) return company('http://stripe.com')
      if (url.endsWith('/paragon')) return company('https://uk.whatjobs.com') // a board, not the employer
      if (url.endsWith('/nosite')) return company(undefined)
      if (url.endsWith('/gone')) return res(404)
      throw new Error('network down')
    }) as unknown as typeof fetch
    const out = await loadFreehireCompanyWebsites(['stripe', 'paragon', 'nosite', 'gone', 'boom'], fetchFn, 0)
    expect([...out.entries()]).toEqual([['stripe', 'http://stripe.com']])
  })

  it('looks each company up once, and does nothing for an empty list', async () => {
    const fetchFn = jest.fn(async () => company('https://acme.io')) as unknown as typeof fetch
    await loadFreehireCompanyWebsites(['a', 'a', 'a', ''], fetchFn, 0)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const none = jest.fn() as unknown as typeof fetch
    expect((await loadFreehireCompanyWebsites([], none, 0)).size).toBe(0)
    expect(none).not.toHaveBeenCalled()
  })

  it('waits out a 429 (Retry-After) and then succeeds', async () => {
    let calls = 0
    const fetchFn = jest.fn(async () => (++calls === 1 ? res(429, undefined, { 'retry-after': '0' }) : company('https://acme.io'))) as unknown as typeof fetch
    const out = await loadFreehireCompanyWebsites(['acme'], fetchFn, 0)
    expect(out.get('acme')).toBe('https://acme.io')
    expect(calls).toBe(2)
  })

  it('stops looking up more companies once the time budget is used up, returning what it has', async () => {
    const fetchFn = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 15))
      return company('https://acme.io')
    }) as unknown as typeof fetch
    const slugs = Array.from({ length: 40 }, (_, i) => `c${i}`)
    const out = await loadFreehireCompanyWebsites(slugs, fetchFn, 0, 40)
    expect(out.size).toBeGreaterThan(0)
    expect(out.size).toBeLessThan(40)
    expect((fetchFn as unknown as jest.Mock).mock.calls.length).toBeLessThan(40)
  })

  it('sends a User-Agent and encodes the slug', async () => {
    const fetchFn = jest.fn(async () => company(null)) as unknown as typeof fetch
    await loadFreehireCompanyWebsites(['a b/c'], fetchFn, 0)
    const [url, init] = (fetchFn as unknown as jest.Mock).mock.calls[0]
    expect(url).toBe('https://freehire.me/api/v1/companies/a%20b%2Fc')
    expect((init as RequestInit).headers).toMatchObject({ 'User-Agent': expect.stringContaining('6FigJobs') })
  })
})

describe('mapFreehireJob keeps the company handle', () => {
  it('passes company_slug through as companyRef', () => {
    const job = {
      public_slug: 'x', url: 'https://example.com/j', title: 'Engineer', company: 'Acme', company_slug: 'acme',
      reality: { class: 'fresh', fake_freshness: false },
      enrichment: { salary_period: 'year', salary_currency: 'USD', salary_min: 150000, salary_max: 190000 },
    } as unknown as FreehireJob
    expect(mapFreehireJob(job)?.companyRef).toBe('acme')
  })
})
