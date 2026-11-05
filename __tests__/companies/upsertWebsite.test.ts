const findFirst = jest.fn()
const update = jest.fn(async ({ data }: any) => ({ id: 'c1', ...data }))
const create = jest.fn()

jest.mock('../../lib/prisma', () => ({ prisma: { company: { findFirst: (...a: any[]) => findFirst(...a), update: (...a: any[]) => update(...a), create: (...a: any[]) => create(...a) } } }))

import { resolveCompanyWebsite, upsertCompanyFromBoard } from '../../lib/companies/upsertFromBoard'

describe('resolveCompanyWebsite', () => {
  it('prefers a real stated website', () => {
    expect(resolveCompanyWebsite({ websiteUrl: 'http://stripe.com', applyUrl: 'https://uk.whatjobs.com/x', source: 'board:freehire' })).toBe('http://stripe.com')
  })

  it('never infers a freehire company website from its apply link (always a board or ATS)', () => {
    expect(resolveCompanyWebsite({ applyUrl: 'https://careers.acme.io/jobs/1', source: 'board:freehire' })).toBeNull()
    expect(resolveCompanyWebsite({ applyUrl: 'https://uk.whatjobs.com/x', source: 'board:freehire' })).toBeNull()
  })

  it('still infers from the apply link for other sources, but not from a board, subdomain or ATS', () => {
    expect(resolveCompanyWebsite({ applyUrl: 'https://careers.acme.io/jobs/1', source: 'board:remoteok' })).toBe('https://careers.acme.io')
    expect(resolveCompanyWebsite({ applyUrl: 'https://uk.whatjobs.com/x', source: 'board:remoteok' })).toBeNull()
    expect(resolveCompanyWebsite({ applyUrl: 'https://boards.greenhouse.io/acme/jobs/1', source: 'board:remoteok' })).toBeNull()
  })

  it('rejects a stated board address', () => {
    expect(resolveCompanyWebsite({ websiteUrl: 'uk.whatjobs.com', source: 'board:freehire' })).toBeNull()
  })
})

describe('upsertCompanyFromBoard fixes a stored board address', () => {
  beforeEach(() => { findFirst.mockReset(); update.mockClear() })
  const base = { rawName: 'Paragon Alpha', source: 'board:freehire', applyUrl: 'https://uk.whatjobs.com/x' }

  it('replaces a stored board website with the real one', async () => {
    findFirst.mockResolvedValue({ id: 'c1', name: 'Paragon Alpha', website: 'https://uk.whatjobs.com' })
    await upsertCompanyFromBoard({ ...base, websiteUrl: 'https://paragonalpha.com' })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ website: 'https://paragonalpha.com' }) }))
  })

  it('clears a stored board website when no real one is known', async () => {
    findFirst.mockResolvedValue({ id: 'c1', name: 'Paragon Alpha', website: 'https://uk.whatjobs.com' })
    await upsertCompanyFromBoard(base)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ website: null }) }))
  })

  it('leaves a valid stored website alone', async () => {
    findFirst.mockResolvedValue({ id: 'c1', name: 'Stripe', website: 'https://stripe.com', atsProvider: 'x', atsUrl: 'y', linkedinUrl: 'z' })
    await upsertCompanyFromBoard({ ...base, rawName: 'Stripe', websiteUrl: 'https://other.com' })
    expect(update).not.toHaveBeenCalled()
  })

  it('fills a missing website', async () => {
    findFirst.mockResolvedValue({ id: 'c1', name: 'Acme', website: null })
    await upsertCompanyFromBoard({ ...base, rawName: 'Acme', websiteUrl: 'https://acme.io' })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ website: 'https://acme.io' }) }))
  })
})
