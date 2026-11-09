jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { shapeRemoteCompanies } from '@/lib/jobs/remoteCompanies'

const company = (id: string, name: string | null, slug: string | null = id) => ({ id, name, slug, logoUrl: null, website: null })

describe('shapeRemoteCompanies', () => {
  it('counts remote jobs per company, most first, then by name', () => {
    const out = shapeRemoteCompanies(
      [
        { companyId: 'a', _count: { _all: 3 } },
        { companyId: 'b', _count: { _all: 9 } },
        { companyId: 'c', _count: { _all: 3 } },
      ],
      [company('a', 'Zapier'), company('b', 'GitLab'), company('c', 'Airbnb')],
    )
    expect(out.map((c) => [c.name, c._count.jobs])).toEqual([
      ['GitLab', 9],
      ['Airbnb', 3],
      ['Zapier', 3],
    ])
  })

  it('leaves out companies without a page slug, a name or a remote job', () => {
    const out = shapeRemoteCompanies(
      [
        { companyId: 'a', _count: { _all: 2 } },
        { companyId: 'b', _count: { _all: 2 } },
        { companyId: null, _count: { _all: 5 } },
      ],
      [company('a', 'NoSlug', null), company('b', null), company('c', 'NoRemote')],
    )
    expect(out).toEqual([])
  })
})
