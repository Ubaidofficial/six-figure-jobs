import { buildSliceCanonicalPath } from '../../lib/seo/canonical'

describe('buildSliceCanonicalPath', () => {
  it('builds role-first canonical paths', () => {
    expect(
      buildSliceCanonicalPath({ roleSlugs: ['software-engineer'], minAnnual: 100_000 }),
    ).toBe('/jobs/software-engineer/100k-plus')

    expect(
      buildSliceCanonicalPath({ roleSlugs: ['software-engineer'], countryCode: 'US', minAnnual: 200_000 }),
    ).toBe('/jobs/software-engineer/united-states/200k-plus')

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
})
