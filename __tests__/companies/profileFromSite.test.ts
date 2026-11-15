import { parseSiteProfile } from '../../lib/companies/profileFromSite'

const page = (head: string) => `<html><head>${head}</head><body></body></html>`

describe('parseSiteProfile', () => {
  it('reads the meta description', () => {
    const p = parseSiteProfile(page('<meta name="description" content="Acme builds payment infrastructure for marketplaces and platforms worldwide.">'))
    expect(p.description).toBe('Acme builds payment infrastructure for marketplaces and platforms worldwide.')
  })

  it('reads Organization data: founding year, size, LinkedIn, country', () => {
    const ld = {
      '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme', foundingDate: '2014-03-01',
      numberOfEmployees: { '@type': 'QuantitativeValue', minValue: 51, maxValue: 200 },
      sameAs: ['https://twitter.com/acme', 'https://www.linkedin.com/company/acme/?trk=x'],
      address: { '@type': 'PostalAddress', addressCountry: 'US' },
    }
    const p = parseSiteProfile(page(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`))
    expect(p).toMatchObject({ foundingYear: 2014, employeeMin: 51, employeeMax: 200, linkedinUrl: 'https://www.linkedin.com/company/acme/', country: 'US' })
  })

  it('finds an Organization inside @graph and takes a plain employee number', () => {
    const ld = { '@graph': [{ '@type': 'WebSite' }, { '@type': 'Organization', numberOfEmployees: 120 }] }
    expect(parseSiteProfile(page(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`))).toMatchObject({ employeeMin: 120, employeeMax: 120 })
  })

  it('returns nothing it was not told: too-short descriptions, bad JSON, no data', () => {
    expect(parseSiteProfile(page('<meta name="description" content="Welcome to Acme">'))).toEqual({})
    expect(parseSiteProfile(page('<script type="application/ld+json">{not json</script>'))).toEqual({})
    expect(parseSiteProfile('<html></html>')).toEqual({})
  })

  it('keeps the longest description and caps it', () => {
    const long = 'x'.repeat(700)
    const p = parseSiteProfile(page(`<meta name="description" content="A short but sufficiently long description of the business here."><meta property="og:description" content="${long}">`))
    expect(p.description!.length).toBe(500)
    expect(p.description!.endsWith('…')).toBe(true)
  })
})
