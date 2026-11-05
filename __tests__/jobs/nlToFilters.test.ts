import { parseSearchQuery } from '../../lib/jobs/nlToFilters'

describe('parseSearchQuery country detection', () => {
  it('does not find a country code inside another word', () => {
    for (const q of ['python developer', 'product designer', 'data analyst', 'sales engineer', 'machine learning']) {
      expect(parseSearchQuery(q).countryCode).toBeUndefined()
    }
  })
  it('still finds countries and cities as whole words', () => {
    expect(parseSearchQuery('backend jobs in germany').countryCode).toBe('DE')
    expect(parseSearchQuery('engineer berlin').countryCode).toBe('DE')
    expect(parseSearchQuery('python developer uk').countryCode).toBe('GB')
    expect(parseSearchQuery('jobs in united states').countryCode).toBe('US')
  })
})

describe('parseSearchQuery seniority detection', () => {
  it('does not find a level inside another word', () => {
    expect(parseSearchQuery('sre').experienceLevel).toBeUndefined() // "sr" inside "sre"
    expect(parseSearchQuery('middleware engineer').experienceLevel).toBeUndefined() // "mid" inside "middleware"
  })
  it('still finds levels as whole words', () => {
    expect(parseSearchQuery('senior engineer').experienceLevel).toBe('senior')
    expect(parseSearchQuery('sr engineer').experienceLevel).toBe('senior')
    expect(parseSearchQuery('staff engineer').experienceLevel).toBe('lead')
  })
})
