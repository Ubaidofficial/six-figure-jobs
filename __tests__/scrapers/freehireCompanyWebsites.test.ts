const queryRaw = jest.fn()
const executeRaw = jest.fn()
jest.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a), $executeRaw: (...a: unknown[]) => executeRaw(...a) } }))
jest.mock('../../lib/prisma', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a), $executeRaw: (...a: unknown[]) => executeRaw(...a) } }))
const ingestBoardJob = jest.fn()
jest.mock('../../lib/jobs/ingestBoardJob', () => ({ ingestBoardJob: (...a: unknown[]) => ingestBoardJob(...a) }))

import { companiesToLookUp, freehireCompanyKey, loadKnownCompanies, WEBSITE_RECHECK_DAYS } from '../../lib/scrapers/freehireCompanyWebsites'
import { ingestFreehireJobs } from '../../lib/scrapers/freehire'
import type { BoardJobInput } from '../../lib/jobs/ingestBoardJob'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-11-20T00:00:00Z')

describe('which freehire companies are asked for a website', () => {
  it('skips companies that already have a website, or were asked in the last 30 days; asks the rest', () => {
    const known = new Map([
      ['acme', { hasWebsite: true, checkedAt: null }],
      ['beta', { hasWebsite: false, checkedAt: new Date(now.getTime() - 3 * DAY) }],
      ['gamma', { hasWebsite: false, checkedAt: new Date(now.getTime() - (WEBSITE_RECHECK_DAYS + 1) * DAY) }],
      ['delta', { hasWebsite: false, checkedAt: null }],
    ])
    const plan = companiesToLookUp(
      [
        { slug: 'acme-inc', key: 'acme' },
        { slug: 'beta', key: 'beta' },
        { slug: 'gamma', key: 'gamma' },
        { slug: 'delta', key: 'delta' },
        { slug: 'new-co', key: 'new co' },
        { slug: 'no-name', key: null },
      ],
      known,
      now,
    )
    expect(plan).toEqual({ lookUp: ['gamma', 'delta', 'new-co', 'no-name'], hasWebsite: 1, checkedRecently: 1 })
  })

  it('matches companies the way the ingest saves them: the cleaned name, any case', () => {
    expect(freehireCompanyKey('Acme Labs')).toBe(freehireCompanyKey('ACME LABS'))
    expect(freehireCompanyKey(null)).toBeNull()
  })

  it('counts a name as having a website only when every company saved under it has a valid one', async () => {
    queryRaw.mockResolvedValueOnce([
      { key: 'acme', website: 'https://acme.com', checked: null },
      { key: 'acme', website: null, checked: null },
      { key: 'stripe', website: 'https://stripe.com', checked: null },
      { key: 'board', website: 'https://boards.greenhouse.io/board', checked: null },
    ])
    const known = await loadKnownCompanies(['acme', 'stripe', 'board'])
    expect(known.get('acme')?.hasWebsite).toBe(false)
    expect(known.get('stripe')?.hasWebsite).toBe(true)
    expect(known.get('board')?.hasWebsite).toBe(false) // an ATS address is not a company website
  })
})

describe('ingestFreehireJobs with the website cache', () => {
  const job = (id: string, company: string, slug: string): BoardJobInput => ({ externalId: id, title: 't', url: `https://x.example/${id}`, rawCompanyName: company, companyRef: slug })
  let fetchSpy: jest.SpyInstance
  beforeEach(() => {
    queryRaw.mockReset()
    executeRaw.mockReset().mockResolvedValue(0)
    ingestBoardJob.mockReset().mockResolvedValue('new')
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/fresh-co')
        ? new Response(JSON.stringify({ data: { company: { company_info: { website: 'https://fresh.example' } } } }), { status: 200 })
        : new Response('{}', { status: 404 }),
    )
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('asks freehire only about companies not known, gives found websites to their jobs, and records who was asked', async () => {
    queryRaw.mockResolvedValueOnce([
      { key: freehireCompanyKey('Known Co'), website: 'https://known.example', checked: null },
      { key: freehireCompanyKey('Recent Co'), website: null, checked: new Date(Date.now() - DAY) },
    ])
    const inputs = [job('1', 'Known Co', 'known-co'), job('2', 'Recent Co', 'recent-co'), job('3', 'Fresh Co', 'fresh-co'), job('4', 'Gone Co', 'gone-co')]
    await ingestFreehireJobs(inputs)
    const asked = fetchSpy.mock.calls.map((c) => String(c[0]).split('/').pop())
    expect(asked.sort()).toEqual(['fresh-co', 'gone-co'])
    expect(inputs[2].companyWebsiteUrl).toBe('https://fresh.example')
    // Both answers (a website, and "no such company") are recorded, after the ingest.
    expect(executeRaw).toHaveBeenCalledTimes(1)
    const keys = executeRaw.mock.calls[0].find((a: unknown) => Array.isArray(a) && !('raw' in (a as object)))
    expect([...(keys as string[])].sort()).toEqual([freehireCompanyKey('Fresh Co'), freehireCompanyKey('Gone Co')].sort())
  })

  it('asks about every company when the cache cannot be read, and never stops the ingest', async () => {
    queryRaw.mockRejectedValueOnce(new Error('column "freehireWebsiteCheckedAt" does not exist'))
    executeRaw.mockRejectedValueOnce(new Error('column "freehireWebsiteCheckedAt" does not exist'))
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    const stats = await ingestFreehireJobs([job('1', 'Known Co', 'known-co'), job('2', 'Fresh Co', 'fresh-co')])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(stats.created).toBe(2)
  })
})
