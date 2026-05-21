import { buildSliceCanonicalPath } from '../../lib/seo/canonical'

describe('buildSliceCanonicalPath', () => {
  it('builds role-first canonical paths', () => {
    expect(
      buildSliceCanonicalPath({ roleSlugs: ['software-engineer'], minAnnual: 100_000 }),
    ).toBe('/jobs/software-engineer/100k-plus')

    expect(
      buildSliceCanonicalPath({ roleSlugs: ['software-engineer'], countryCode: 'US', minAnnual: 200_000 }),
    ).toBe('/jobs/software-engineer/200k-plus')

    expect(
      buildSliceCanonicalPath({ roleSlugs: ['software-engineer'], remoteOnly: true, minAnnual: 300_000 }),
    ).toBe('/remote/software-engineer')
  })

  it('uses durable hubs for generic slices', () => {
    expect(buildSliceCanonicalPath({ minAnnual: 100_000 })).toBe('/jobs/100k-plus')
    expect(buildSliceCanonicalPath({ countryCode: 'GB', minAnnual: 100_000 })).toBe(
      '/jobs/location/united-kingdom',
    )
    expect(buildSliceCanonicalPath({ remoteOnly: true, minAnnual: 100_000 })).toBe('/remote')
  })

  it('uses supported combo routes instead of redirect-only paths', () => {
    expect(
      buildSliceCanonicalPath({ roleSlugs: ['software-engineer'], citySlug: 'new-york', minAnnual: 200_000 }),
    ).toBe('/jobs/software-engineer/city/new-york')
  })
})
