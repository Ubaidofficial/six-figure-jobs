import { __clearMemoForTests } from '../../lib/cache/memo'
import { getCompanyPublishingManifest } from '../../lib/seo/companyPublishing'
import { GET as getCompanySitemapPage } from '../../app/sitemap-company/[page]/route'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({ prisma: { job: { findMany: jest.fn() }, company: { findMany: jest.fn() } } }))

const jobs = prisma.job.findMany as unknown as jest.Mock
const companies = prisma.company.findMany as unknown as jest.Mock

// Search Console, 2026-11-26: every URL in /sitemap-company/1 carried the same <lastmod> (the day of the last scraper
// re-sync), because it came from Job.updatedAt / Company.updatedAt, which every re-sync bumps. It must be the day the newest
// live job was posted (Job.createdAt), which only moves when a visitor would see a new job on the company page.
const job = (createdAt: string, updatedAt: string) => ({
  companyId: 'c1',
  roleSlug: 'software-engineer',
  citySlug: null,
  countryCode: 'US',
  remote: true,
  remoteMode: 'remote',
  salarySource: 'ats',
  aiSnippet: null,
  aiOneLiner: null,
  descriptionHtml: null,
  createdAt: new Date(createdAt),
  updatedAt: new Date(updatedAt), // what a re-sync bumps; a prisma select of createdAt would not return it, but it must be ignored either way
})

describe('company sitemap lastmod', () => {
  beforeEach(() => {
    __clearMemoForTests()
    jobs.mockReset()
    companies.mockReset()
  })

  it('dates a company by its newest posted job, not by the re-sync stamp on the job or company rows', async () => {
    jobs.mockResolvedValue([job('2026-11-10T08:00:00Z', '2026-11-26T03:00:00Z'), job('2026-11-18T09:00:00Z', '2026-11-26T03:00:00Z')])
    companies.mockResolvedValue([
      { id: 'c1', slug: 'acme', name: 'Acme', description: null, website: null, logoUrl: null, industry: null, sizeBucket: null, headquarters: null, atsUrl: null, updatedAt: new Date('2026-11-26T03:00:00Z') },
    ])
    const manifest = await getCompanyPublishingManifest()
    expect(manifest.candidates[0].latestJobPostedAt).toBe('2026-11-18T09:00:00.000Z')
    const select = jobs.mock.calls[0][0].select
    expect(select.createdAt).toBe(true)
    expect(select.updatedAt).toBeUndefined()
  })
})

jest.mock('../../lib/seo/sitemapWaves', () => ({ ...jest.requireActual('../../lib/seo/sitemapWaves'), areCompanyPagesReleased: () => true }))
jest.mock('../../lib/seo/companyPublishing', () => ({
  ...jest.requireActual('../../lib/seo/companyPublishing'),
  getPublishedCompanyCandidatesPage: jest.fn(),
}))

describe('company sitemap page', () => {
  const { getPublishedCompanyCandidatesPage } = jest.requireMock('../../lib/seo/companyPublishing')
  const call = () => getCompanySitemapPage(new Request('http://localhost:3000/sitemap-company/1'), { params: Promise.resolve({ page: '1' }) })

  beforeEach(() => __clearMemoForTests())

  it('writes the posting day, and no <lastmod> at all (never the request day) when a company has no dated job', async () => {
    getPublishedCompanyCandidatesPage.mockResolvedValue([
      { slug: 'acme', latestJobPostedAt: '2026-11-18T09:00:00.000Z' },
      { slug: 'globex', latestJobPostedAt: null },
    ])
    const xml = await (await call()).text()
    expect(xml).toContain('/company/acme</loc>\n    <lastmod>2026-11-18</lastmod>')
    expect(xml).toContain('/company/globex</loc>\n  </url>')
    expect(xml.match(/<lastmod>/g)).toHaveLength(1)
  })
})
