import { isValidCompanyWebsite, normalizePublicCompanyWebsite } from '../../lib/companies/website'
import { buildLogoUrl } from '../../lib/companies/logo'

describe('job boards are not company websites', () => {
  it('rejects the board addresses that showed up as an employer website', () => {
    for (const url of [
      'uk.whatjobs.com',
      'https://uk.whatjobs.com/jobs/x',
      'www.indeed.com',
      'https://ca.indeed.com',
      'https://www.reed.co.uk/jobs',
      'https://www.glassdoor.com',
      'jooble.org',
    ]) {
      expect(normalizePublicCompanyWebsite(url)).toBeNull()
      expect(isValidCompanyWebsite(url)).toBe(false)
    }
  })

  it('still accepts real company sites, including look-alike names', () => {
    expect(normalizePublicCompanyWebsite('https://stripe.com/')).toBe('https://stripe.com')
    expect(normalizePublicCompanyWebsite('acme.io')).toBe('https://acme.io')
    expect(normalizePublicCompanyWebsite('https://whatjobsfoundation.org')).toBe('https://whatjobsfoundation.org')
    expect(normalizePublicCompanyWebsite('https://indeedsoftware.dev')).toBe('https://indeedsoftware.dev')
  })

  it('so the logo falls back to a name lookup (never the board logo)', () => {
    expect(buildLogoUrl(null, 'uk.whatjobs.com', 'Paragon Alpha')).toBe('/logo/name/Paragon%20Alpha')
    expect(buildLogoUrl(null, 'https://stripe.com', 'Stripe')).toBe('/logo/domain/stripe.com')
  })
})
