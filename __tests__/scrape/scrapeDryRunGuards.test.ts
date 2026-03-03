import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    company: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    companyATS: {
      upsert: jest.fn(),
    },
  },
}))

const companyMock = (prisma as any).company as {
  findFirst: jest.Mock
  findUnique: jest.Mock
  create: jest.Mock
  update: jest.Mock
}

const companyAtsMock = (prisma as any).companyATS as {
  upsert: jest.Mock
}

describe('scrape dry-run guards', () => {
  const envSnapshot = { ...process.env }

  beforeEach(() => {
    process.env = { ...envSnapshot }
    companyMock.findFirst.mockReset()
    companyMock.findUnique.mockReset()
    companyMock.create.mockReset()
    companyMock.update.mockReset()
    companyAtsMock.upsert.mockReset()
  })

  afterAll(() => {
    process.env = envSnapshot
  })

  it('upsertCompanyFromBoard returns synthetic company without writes in dry-run mode', async () => {
    process.env.SCRAPE_DRY_RUN = '1'
    companyMock.findFirst.mockResolvedValue(null)

    const { upsertCompanyFromBoard } = await import('../../lib/companies/upsertFromBoard')

    const result = await upsertCompanyFromBoard({
      rawName: 'Acme Labs',
      source: 'board:test',
      applyUrl: 'https://jobs.acme.com/roles/123',
    })

    expect(result).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^dryrun:/),
        name: 'Acme Labs',
        slug: 'acme-labs',
      }),
    )
    expect(companyMock.create).not.toHaveBeenCalled()
    expect(companyMock.update).not.toHaveBeenCalled()
  })

  it('upsertCompanyFromBoard skips update writes in dry-run mode', async () => {
    process.env.SCRAPE_DRY_RUN = '1'
    companyMock.findFirst.mockResolvedValue({
      id: 'company_1',
      name: 'Acme Labs',
      slug: 'acme-labs',
      website: null,
      atsProvider: null,
      atsUrl: null,
      linkedinUrl: null,
    })

    const { upsertCompanyFromBoard } = await import('../../lib/companies/upsertFromBoard')

    const result = await upsertCompanyFromBoard({
      rawName: 'Acme Labs',
      source: 'board:test',
      websiteUrl: 'https://acme.com',
    })

    expect(result).toEqual(
      expect.objectContaining({
        id: 'company_1',
        website: 'https://acme.com',
      }),
    )
    expect(companyMock.update).not.toHaveBeenCalled()
  })

  it('saveCompanyATS is a no-op in dry-run mode', async () => {
    process.env.SCRAPE_DRY_RUN = '1'
    const { saveCompanyATS } = await import('../../lib/scrapers/utils/saveCompanyATS')

    await saveCompanyATS('Acme Labs', 'https://boards.greenhouse.io/acme/jobs/123', 'remoteok')

    expect(companyAtsMock.upsert).not.toHaveBeenCalled()
  })
})
