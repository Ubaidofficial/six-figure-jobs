jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('../../lib/jobs/ingestBoardJob', () => ({ ingestBoardJob: jest.fn() }))

import { boardFromJobUrls, freehireSlugGuesses, lookupFreehireCompany } from '../../lib/scrapers/freehireCompanyBoard'

// Shapes seen live on 2026-11-16 (freehire company and job-search responses, trimmed).
const ashby = (id: string) => `https://jobs.ashbyhq.com/fireworks/${id}?utm_source=freehire.me`

function res(status: number, body?: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body, body: null } as unknown as Response
}

describe('freehireSlugGuesses', () => {
  it('gives the hyphenated name first, so "Fal.ai" is fal-ai and "Applied Intuition" applied-intuition', () => {
    expect(freehireSlugGuesses('Fal.ai')[0]).toBe('fal-ai')
    expect(freehireSlugGuesses('Applied Intuition')[0]).toBe('applied-intuition')
    expect(freehireSlugGuesses('')).toEqual([])
  })
})

describe('boardFromJobUrls', () => {
  it("reads the employer's board from its job links", () => {
    expect(boardFromJobUrls([ashby('a'), ashby('b')])).toEqual({ provider: 'ashby', url: 'https://jobs.ashbyhq.com/fireworks' })
  })

  it('takes the board most links point to, and ignores aggregator links', () => {
    expect(
      boardFromJobUrls([
        'https://en-ca.whatjobs.com/pub_api__cpl__1?utm_source=freehire.me',
        'https://boards.greenhouse.io/imbue/jobs/1',
        'https://jobs.lever.co/other/2',
        'https://boards.greenhouse.io/imbue/jobs/3',
      ]),
    ).toEqual({ provider: 'greenhouse', url: 'https://boards.greenhouse.io/imbue' })
  })

  it('returns null for aggregator-only links and for the Workable short link, which names no account (seen live: Sakana AI)', () => {
    expect(boardFromJobUrls(['https://en-ca.whatjobs.com/x', 'https://www.comeet.com/jobs/cyera/17.008/x'])).toBeNull()
    expect(boardFromJobUrls(['https://apply.workable.com/j/AA79C0ABA6?utm_source=freehire.me'])).toBeNull()
    expect(boardFromJobUrls([])).toBeNull()
  })
})

describe('lookupFreehireCompany', () => {
  const company = (slug: string, name: string, extra: object = {}) =>
    res(200, { data: { company: { slug, name, job_count: 76, company_info: { website: 'https://fireworks.ai' }, ...extra } } })
  const jobs = res(200, { data: [{ url: ashby('a') }, { url: ashby('b') }] })

  it('returns the company, its job count, website and board', async () => {
    const fetchImpl = jest.fn(async (url: string) => (url.includes('/companies/') ? company('fireworks-ai', 'Fireworks AI') : jobs)) as unknown as typeof fetch
    await expect(lookupFreehireCompany('Fireworks AI', { fetchImpl, gapMs: 0 })).resolves.toEqual({
      slug: 'fireworks-ai',
      name: 'Fireworks AI',
      jobCount: 76,
      website: 'https://fireworks.ai',
      board: { provider: 'ashby', url: 'https://jobs.ashbyhq.com/fireworks' },
    })
  })

  it('accepts a name written differently by freehire (Skild AI is "skildai", Safe Superintelligence is "... Inc.")', async () => {
    const f1 = jest.fn(async (url: string) => (url.includes('/companies/') ? company('skild-ai', 'skildai') : jobs)) as unknown as typeof fetch
    expect((await lookupFreehireCompany('Skild AI', { fetchImpl: f1, gapMs: 0 }))?.slug).toBe('skild-ai')
    const f2 = jest.fn(async (url: string) => (url.includes('/companies/') ? company('safe-superintelligence', 'Safe Superintelligence Inc.') : jobs)) as unknown as typeof fetch
    expect((await lookupFreehireCompany('Safe Superintelligence', { fetchImpl: f2, gapMs: 0 }))?.slug).toBe('safe-superintelligence')
  })

  it('rejects a slug that belongs to a differently named company', async () => {
    const fetchImpl = jest.fn(async (url: string) => (url.includes('/companies/') ? company('gamma', 'Gamma Industries Ltd') : jobs)) as unknown as typeof fetch
    await expect(lookupFreehireCompany('Gamma', { fetchImpl, gapMs: 0 })).resolves.toBeNull()
  })

  it('returns null for a company freehire does not have (404, as for SerpApi)', async () => {
    const fetchImpl = jest.fn(async () => res(404)) as unknown as typeof fetch
    await expect(lookupFreehireCompany('SerpApi', { fetchImpl, gapMs: 0 })).resolves.toBeNull()
  })

  it('keeps a company with no usable board, with board null', async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      url.includes('/companies/') ? company('cyera', 'Cyera') : res(200, { data: [{ url: 'https://www.comeet.com/jobs/cyera/1' }] }),
    ) as unknown as typeof fetch
    expect((await lookupFreehireCompany('Cyera', { fetchImpl, gapMs: 0 }))?.board).toBeNull()
  })

  it('stops on a 429 instead of retrying or working around it', async () => {
    const fetchImpl = jest.fn(async () => res(429)) as unknown as typeof fetch
    await expect(lookupFreehireCompany('Acme', { fetchImpl, gapMs: 0 })).rejects.toThrow(/429/)
  })
})
