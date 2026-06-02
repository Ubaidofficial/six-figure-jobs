import fs from 'node:fs'
import path from 'node:path'

import {
  MIN_CITY_INDEXABLE_JOBS,
  MIN_COMPANY_INDEXABLE_JOBS,
  MIN_COUNTRY_INDEXABLE_JOBS,
  MIN_REMOTE_ROLE_INDEXABLE_JOBS,
  MIN_ROLE_FILTER_INDEXABLE_JOBS,
  MIN_SALARY_TIER_INDEXABLE_JOBS,
  isCityPageIndexable,
  isCompanyPageIndexable,
  isCountryPageIndexable,
  isRemoteRolePageIndexable,
  isRoleFilterPageIndexable,
  isSalaryTierPageIndexable,
} from '../../lib/seo/indexabilityGates'

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('indexability gates alignment', () => {
  it('shares company threshold between page robots and company sitemap routes', () => {
    expect(MIN_COMPANY_INDEXABLE_JOBS).toBe(1)
    expect(isCompanyPageIndexable(0)).toBe(false)
    expect(isCompanyPageIndexable(1)).toBe(true)

    const companyIndexRoute = readRepoFile('app/sitemap-company.xml/route.ts')
    const companyPageRoute = readRepoFile('app/sitemap-company/[page]/route.ts')

    expect(companyIndexRoute).toContain('MIN_COMPANY_INDEXABLE_JOBS')
    expect(companyPageRoute).toContain('MIN_COMPANY_INDEXABLE_JOBS')
  })

  it('shares country threshold between page robots and country sitemap route', () => {
    expect(MIN_COUNTRY_INDEXABLE_JOBS).toBe(1)
    expect(isCountryPageIndexable(0)).toBe(false)
    expect(isCountryPageIndexable(1)).toBe(true)

    const countryRoute = readRepoFile('app/sitemap-country.xml/route.ts')
    const countrySitemapHelper = readRepoFile('lib/seo/countrySitemap.ts')
    expect(countryRoute).toContain('getCountrySitemapUrls')
    expect(countrySitemapHelper).toContain('isCountryPageIndexable')
  })

  it('uses the same city robots threshold for sitemap inclusion', () => {
    expect(MIN_CITY_INDEXABLE_JOBS).toBe(1)
    expect(isCityPageIndexable(0)).toBe(false)
    expect(isCityPageIndexable(1)).toBe(true)
  })

  it('shares remote role threshold between page robots and remote sitemap route', () => {
    expect(MIN_REMOTE_ROLE_INDEXABLE_JOBS).toBe(1)
    expect(isRemoteRolePageIndexable(0)).toBe(false)
    expect(isRemoteRolePageIndexable(1)).toBe(true)

    const remotePage = readRepoFile('app/remote/[role]/page.tsx')
    const remoteSitemap = readRepoFile('app/sitemap-remote.xml/route.ts')
    const remoteSitemapHelper = readRepoFile('lib/seo/remoteSitemap.ts')

    expect(remotePage).toContain('isRemoteRolePageIndexable')
    expect(remoteSitemap).toContain('collectRemoteRoleRows')
    expect(remoteSitemapHelper).toContain('isRemoteRolePageIndexable')
  })

  it('uses role filter threshold in role/filter metadata robots gate', () => {
    expect(MIN_ROLE_FILTER_INDEXABLE_JOBS).toBe(3)
    expect(isRoleFilterPageIndexable(2)).toBe(false)
    expect(isRoleFilterPageIndexable(3)).toBe(true)

    const roleFilterPage = readRepoFile('app/jobs/[role]/[filter]/page.tsx')
    expect(roleFilterPage).toContain('isRoleFilterPageIndexable')
  })

  it('shares salary tier gating between page robots and salary sitemap output', () => {
    expect(MIN_SALARY_TIER_INDEXABLE_JOBS).toBe(3)
    expect(isSalaryTierPageIndexable(2)).toBe(false)
    expect(isSalaryTierPageIndexable(3)).toBe(true)

    const salaryTierPage = readRepoFile('app/jobs/100k-plus/page.tsx')
    const salarySitemapRoute = readRepoFile('app/sitemap-salary.xml/route.ts')

    expect(salaryTierPage).toContain('isSalaryTierPageIndexable')
    expect(salarySitemapRoute).toContain('isSalaryTierPageIndexable')
  })
})
