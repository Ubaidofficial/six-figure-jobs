import { __clearMemoForTests } from '../../lib/cache/memo'
import { getCompanyPublishingManifest } from '../../lib/seo/companyPublishing'
import { prisma } from '../../lib/prisma'

// The Next data cache is not available in jest; a passthrough stands in so only the in-process cache is under test.
jest.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
jest.mock('../../lib/prisma', () => ({ prisma: { job: { findMany: jest.fn() }, company: { findMany: jest.fn() } } }))

const jobs = prisma.job.findMany as unknown as jest.Mock

// Building the manifest reads every live job: 8-12 s on production for /companies and /sitemap-company/<n> on every request.
describe('company publishing manifest cache', () => {
  beforeEach(() => {
    __clearMemoForTests()
    jobs.mockReset()
    ;(prisma.company.findMany as unknown as jest.Mock).mockReset().mockResolvedValue([])
  })

  it('builds the manifest once and serves repeats (and concurrent requests) from memory', async () => {
    jobs.mockResolvedValue([])
    const [a, b] = await Promise.all([getCompanyPublishingManifest(), getCompanyPublishingManifest()])
    const c = await getCompanyPublishingManifest()
    expect(jobs).toHaveBeenCalledTimes(1)
    expect(b).toBe(a)
    expect(c).toBe(a)
    expect(a.candidates).toEqual([])
  })

  it('does not keep a failed build: the caller gets an empty manifest once, and the next request builds again and keeps it', async () => {
    jobs.mockRejectedValueOnce(new Error('database down')).mockResolvedValue([])
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const failed = await getCompanyPublishingManifest()
    expect(failed.candidates).toEqual([])
    expect(failed.unlockedCount).toBe(0)
    const ok = await getCompanyPublishingManifest()
    const again = await getCompanyPublishingManifest()
    expect(jobs).toHaveBeenCalledTimes(2) // the failure was not kept; the good build was
    expect(again).toBe(ok)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})
