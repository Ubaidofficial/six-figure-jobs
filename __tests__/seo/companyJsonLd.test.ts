import { buildCompanyJsonLd } from '@/lib/seo/companyJsonLd'

const company = (over: Record<string, unknown>) =>
  ({ name: 'Acme', slug: 'acme', logoUrl: null, website: 'https://acme.com', linkedinUrl: null, foundedYear: null, ...over }) as any

describe('buildCompanyJsonLd', () => {
  it('keeps sameAs a single URL when only the website is known, and omits foundingDate', () => {
    const ld = buildCompanyJsonLd(company({}), [])
    expect(ld.sameAs).toBe('https://acme.com')
    expect(ld).not.toHaveProperty('foundingDate')
  })
  it('adds the LinkedIn page and founding year when stored', () => {
    const ld = buildCompanyJsonLd(
      company({ linkedinUrl: 'https://www.linkedin.com/company/acme', foundedYear: 2015 }),
      [],
    )
    expect(ld.sameAs).toEqual(['https://acme.com', 'https://www.linkedin.com/company/acme'])
    expect(ld.foundingDate).toBe('2015')
  })
})
