import { GET as getCompanySitemapIndex } from '../../app/sitemap-company.xml/route'
import { GET as getCompanySitemapPage } from '../../app/sitemap-company/[page]/route'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    company: {
      findMany: jest.fn(),
    },
  },
}))

const findManyMock = (prisma.company.findMany as unknown) as jest.Mock

describe('company sitemap routes', () => {
  beforeEach(() => {
    findManyMock.mockReset()
  })

  it('does not emit /sitemap-company/1 when there are zero eligible companies', async () => {
    findManyMock.mockResolvedValueOnce([])

    const response = await getCompanySitemapIndex()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).not.toContain('/sitemap-company/1')
  })

  it('returns empty urlset with 200 for page 1 when there are no rows', async () => {
    findManyMock.mockResolvedValueOnce([])

    const response = await getCompanySitemapPage(new Request('http://localhost:3000/sitemap-company/1'), {
      params: Promise.resolve({ page: '1' }),
    })
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(xml).toContain('<urlset')
    expect(xml).not.toContain('<url>')
  })

  it('returns 404 for page > 1 when there are no rows', async () => {
    findManyMock.mockResolvedValueOnce([])

    const response = await getCompanySitemapPage(new Request('http://localhost:3000/sitemap-company/2'), {
      params: Promise.resolve({ page: '2' }),
    })

    expect(response.status).toBe(404)
  })
})
