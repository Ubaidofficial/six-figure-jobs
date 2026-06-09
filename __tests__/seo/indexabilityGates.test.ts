import fs from 'node:fs'
import path from 'node:path'

import {
  MIN_CITY_INDEXABLE_JOBS,
  MIN_COMPANY_INDEXABLE_JOBS,
  MIN_COUNTRY_INDEXABLE_JOBS,
  MIN_REMOTE_ROLE_INDEXABLE_JOBS,
  MIN_ROLE_FILTER_INDEXABLE_JOBS,
  MIN_SALARY_TIER_INDEXABLE_JOBS,
  MIN_SALARY_ROLE_LOCATION_INDEXABLE_JOBS,
  isSalaryRoleLocationPageIndexable,
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
  it('uses a stricter company threshold and manifest-based publishing', () => {
    expect(MIN_COMPANY_INDEXABLE_JOBS).toBe(5)
    expect(isCompanyPageIndexable(0)).toBe(false)
    expect(isCompanyPageIndexable(4)).toBe(false)
    expect(isCompanyPageIndexable(5)).toBe(true)

    const companyIndexRoute = readRepoFile('app/sitemap-company.xml/route.ts')
    const companyPageRoute = readRepoFile('app/sitemap-company/[page]/route.ts')
    const companyPage = readRepoFile('app/company/[slug]/page.tsx')

    expect(companyIndexRoute).toContain('getPublishedCompanyCandidateCount')
    expect(companyPageRoute).toContain('getPublishedCompanyCandidatesPage')
    expect(companyPage).toContain('getCompanyPublishingDecision')
  })

  it('shares country threshold between page robots and country sitemap route', () => {
    expect(MIN_COUNTRY_INDEXABLE_JOBS).toBe(5)
    expect(isCountryPageIndexable(0)).toBe(false)
    expect(isCountryPageIndexable(4)).toBe(false)
    expect(isCountryPageIndexable(5)).toBe(true)

    const countryRoute = readRepoFile('app/sitemap-country.xml/route.ts')
    const countrySitemapHelper = readRepoFile('lib/seo/countrySitemap.ts')
    expect(countryRoute).toContain('getCountrySitemapUrls')
    expect(countrySitemapHelper).toContain('isCountryPageIndexable')
  })

  it('uses the same city robots threshold for sitemap inclusion', () => {
    expect(MIN_CITY_INDEXABLE_JOBS).toBe(5)
    expect(isCityPageIndexable(0)).toBe(false)
    expect(isCityPageIndexable(4)).toBe(false)
    expect(isCityPageIndexable(5)).toBe(true)
  })

  it('shares remote role threshold between page robots and remote sitemap route', () => {
    expect(MIN_REMOTE_ROLE_INDEXABLE_JOBS).toBe(5)
    expect(isRemoteRolePageIndexable(0)).toBe(false)
    expect(isRemoteRolePageIndexable(4)).toBe(false)
    expect(isRemoteRolePageIndexable(5)).toBe(true)

    const remotePage = readRepoFile('app/remote/[role]/page.tsx')
    const remoteSitemap = readRepoFile('app/sitemap-remote.xml/route.ts')
    const remoteSitemapHelper = readRepoFile('lib/seo/remoteSitemap.ts')

    expect(remotePage).toContain('isRemoteRolePageIndexable')
    expect(remoteSitemap).toContain('collectRemoteRoleRows')
    expect(remoteSitemapHelper).toContain('isRemoteRolePageIndexable')
  })

  it('uses role filter threshold in role/filter metadata robots gate', () => {
    expect(MIN_ROLE_FILTER_INDEXABLE_JOBS).toBe(5)
    expect(isRoleFilterPageIndexable(4)).toBe(false)
    expect(isRoleFilterPageIndexable(5)).toBe(true)

    const roleFilterPage = readRepoFile('app/jobs/[role]/[filter]/page.tsx')
    expect(roleFilterPage).toContain('isRoleFilterPageIndexable')
  })

  it('shares salary tier gating between page robots and salary sitemap output', () => {
    expect(MIN_SALARY_TIER_INDEXABLE_JOBS).toBe(5)
    expect(isSalaryTierPageIndexable(4)).toBe(false)
    expect(isSalaryTierPageIndexable(5)).toBe(true)

    const salaryTierPage = readRepoFile('app/jobs/100k-plus/page.tsx')
    const salarySitemapRoute = readRepoFile('app/sitemap-salary.xml/route.ts')

    expect(salaryTierPage).toContain('isSalaryTierPageIndexable')
    expect(salarySitemapRoute).toContain('isSalaryTierPageIndexable')
  })

  it('shares salary role-location gating with the unified 5-job threshold', () => {
    expect(MIN_SALARY_ROLE_LOCATION_INDEXABLE_JOBS).toBe(5)
    expect(isSalaryRoleLocationPageIndexable(4)).toBe(false)
    expect(isSalaryRoleLocationPageIndexable(5)).toBe(true)

    const salaryRoleLocationPage = readRepoFile('app/salary/[role]/[...loc]/page.tsx')
    expect(salaryRoleLocationPage).toContain('isSalaryRoleLocationPageIndexable')
  })
})
