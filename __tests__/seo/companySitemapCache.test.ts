import { GET } from '../../app/sitemap-company/[page]/route'
import { __clearMemoForTests } from '../../lib/cache/memo'
import { getPublishedCompanyCandidatesPage } from '../../lib/seo/companyPublishing'

jest.mock('../../lib/seo/companyPublishing', () => ({ getPublishedCompanyCandidatesPage: jest.fn() }))

const candidates = getPublishedCompanyCandidatesPage as unknown as jest.Mock
const call = (page: string) => GET(new Request(`http://localhost:3000/sitemap-company/${page}`), { params: Promise.resolve({ page }) })

// /sitemap-company/1 took 8-12 s on production (2026-11-21) because the list of published companies is built on every fetch.
describe('company sitemap page cache', () => {
  beforeEach(() => {
    __clearMemoForTests()
    candidates.mockReset()
  })

  it('builds the list once and serves the repeat from memory', async () => {
    candidates.mockResolvedValue([{ slug: 'acme', latestUpdatedAt: '2026-11-20T10:00:00.000Z' }])
    const first = await (await call('1')).text()
    const second = await (await call('1')).text()
    expect(first).toContain('/company/acme')
    expect(second).toBe(first)
    expect(candidates).toHaveBeenCalledTimes(1)
  })

  it('does not keep an empty page 1 (a list that failed to build), so the next request builds again', async () => {
    candidates.mockResolvedValueOnce([]).mockResolvedValueOnce([{ slug: 'acme', latestUpdatedAt: '2026-11-20T10:00:00.000Z' }])
    expect(await (await call('1')).text()).not.toContain('<url>')
    expect(await (await call('1')).text()).toContain('/company/acme')
    expect(candidates).toHaveBeenCalledTimes(2)
  })

  it('does not keep a 404', async () => {
    candidates.mockResolvedValue([])
    expect((await call('2')).status).toBe(404)
    expect((await call('2')).status).toBe(404)
    expect(candidates).toHaveBeenCalledTimes(2)
  })
})
