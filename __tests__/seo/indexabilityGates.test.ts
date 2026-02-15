import fs from 'node:fs'
import path from 'node:path'

import {
  MIN_CITY_INDEXABLE_JOBS,
  MIN_COMPANY_INDEXABLE_JOBS,
  MIN_COUNTRY_INDEXABLE_JOBS,
  isCityPageIndexable,
  isCompanyPageIndexable,
  isCountryPageIndexable,
} from '../../lib/seo/indexabilityGates'

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('indexability gates alignment', () => {
  it('shares company threshold between page robots and company sitemap routes', () => {
    expect(MIN_COMPANY_INDEXABLE_JOBS).toBe(3)
    expect(isCompanyPageIndexable(2)).toBe(false)
    expect(isCompanyPageIndexable(3)).toBe(true)

    const companyIndexRoute = readRepoFile('app/sitemap-company.xml/route.ts')
    const companyPageRoute = readRepoFile('app/sitemap-company/[page]/route.ts')

    expect(companyIndexRoute).toContain('MIN_COMPANY_INDEXABLE_JOBS')
    expect(companyPageRoute).toContain('MIN_COMPANY_INDEXABLE_JOBS')
  })

  it('shares country threshold between page robots and country sitemap route', () => {
    expect(MIN_COUNTRY_INDEXABLE_JOBS).toBe(3)
    expect(isCountryPageIndexable(2)).toBe(false)
    expect(isCountryPageIndexable(3)).toBe(true)

    const countryRoute = readRepoFile('app/sitemap-country.xml/route.ts')
    expect(countryRoute).toContain('MIN_COUNTRY_INDEXABLE_JOBS')
  })

  it('uses the same city robots threshold for sitemap inclusion', () => {
    expect(MIN_CITY_INDEXABLE_JOBS).toBe(3)
    expect(isCityPageIndexable(2)).toBe(false)
    expect(isCityPageIndexable(3)).toBe(true)
  })
})
