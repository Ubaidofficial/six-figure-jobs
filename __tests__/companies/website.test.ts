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

describe('logoLookupName', () => {
  const { logoLookupName } = require('../../lib/companies/logo')
  it('keeps the brand and drops a descriptive suffix', () => {
    expect(logoLookupName('Paragon Alpha - Hedge Fund Talent Business')).toBe('Paragon Alpha')
    expect(logoLookupName('Acme | Careers')).toBe('Acme')
    expect(logoLookupName('Globex (UK) Ltd')).toBe('Globex')
    expect(logoLookupName('Foo \u2013 Bar')).toBe('Foo')
  })

  it('leaves ordinary names, hyphenated names and short results alone', () => {
    expect(logoLookupName('Genomics England')).toBe('Genomics England')
    expect(logoLookupName('Coca-Cola')).toBe('Coca-Cola')
    expect(logoLookupName('Rolls-Royce Holdings')).toBe('Rolls-Royce Holdings')
    expect(logoLookupName('X - Y Corp')).toBe('X - Y Corp')
  })

  it('is used for the name-based logo URL', () => {
    expect(buildLogoUrl(null, null, 'Paragon Alpha - Hedge Fund Talent Business')).toBe('/logo/name/Paragon%20Alpha')
  })
})
