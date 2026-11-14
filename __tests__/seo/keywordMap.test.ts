import { KEYWORD_MAP, keywordsFor, type KeywordPageType } from '../../lib/seo/keywordMap'
import {
  buildCategoryTitle,
  buildCityTitle,
  buildCompanyPageTitle,
  buildCompaniesIndexTitle,
  buildCountryTitle,
  buildJobsHubTitle,
  buildListingTitle,
  buildSalaryGuideTitle,
  buildSalaryTierTitle,
  buildSkillTitle,
  inCountry,
  TITLE_MAX,
} from '../../lib/seo/metaText'

// Hyphens read as spaces ("High-Paying" is "high paying"), case is ignored.
const norm = (s: string) => s.toLowerCase().replace(/-/g, ' ')

// Real title builders (or the same buildListingTitle call the page makes), one per page type that has one.
const TITLES: Partial<Record<KeywordPageType, string[]>> = {
  jobsHub: [buildJobsHubTitle(), buildJobsHubTitle(' (Page 2)')],
  remoteHub: [buildListingTitle({ topic: 'High-Paying Remote Jobs', qualifier: '($100k+)' })],
  remoteRole: [
    buildListingTitle({ topic: 'Remote Software Engineer Jobs', qualifier: 'Paying $100k+' }),
    buildListingTitle({ topic: 'Remote Machine Learning Engineer Jobs', qualifier: 'Paying $100k+' }),
  ],
  role: [buildListingTitle({ topic: 'Software Engineer Jobs', qualifier: 'Paying $100k+' })],
  salaryGuide: [buildSalaryGuideTitle('Software Engineer', '$100k+', 222000), buildSalaryGuideTitle('DevOps Engineer', '$100k+', null)],
  salaryTier: [buildSalaryTierTitle('$100k–$199k'), buildSalaryTierTitle('$400k+')],
  country: [buildCountryTitle('United States', '$100k+', 'US'), buildCountryTitle('Canada', 'C$120k+', 'CA')],
  city: [buildCityTitle('San Francisco', '$100k+', 'US'), buildCityTitle('London', '£75k+', 'GB')],
  skill: [buildSkillTitle('Python'), buildSkillTitle('Kubernetes')],
  category: [buildCategoryTitle('Engineering')],
  company: [buildCompanyPageTitle('Adobe'), buildCompanyPageTitle('Capital One')],
  companies: [buildCompaniesIndexTitle()],
}

describe('keyword map', () => {
  it.each(Object.entries(KEYWORD_MAP))('%s has a primary keyword, secondary keywords and a title fragment', (_type, kw) => {
    expect(kw.primary.length).toBeGreaterThan(0)
    expect(kw.secondary.length).toBeGreaterThanOrEqual(2)
    expect(kw.titleHas).toBe(kw.titleHas.toLowerCase())
  })

  it.each(Object.entries(TITLES))('%s titles keep the primary keyword fragment and fit TITLE_MAX', (type, titles) => {
    const { titleHas } = KEYWORD_MAP[type as KeywordPageType]
    for (const title of titles ?? []) {
      expect(norm(title)).toContain(titleHas)
      expect(title.length).toBeLessThanOrEqual(TITLE_MAX)
    }
  })
})

describe('keywordsFor', () => {
  it('fills in the page values, lowercases, and drops keywords it has no value for', () => {
    expect(keywordsFor('role', { role: 'Software Engineer' })).toEqual([
      'software engineer jobs',
      'high paying software engineer jobs',
      '$100k software engineer jobs',
      'software engineer salary',
    ])
    expect(keywordsFor('city', { city: 'Austin' })).toEqual([
      'high paying jobs in austin',
      '$100k jobs in austin',
      'six figure jobs in austin',
    ])
  })

  it('returns fixed keywords for pages with no placeholders, without duplicates', () => {
    const kws = keywordsFor('highPayingJobs')
    expect(kws[0]).toBe('high paying jobs')
    expect(new Set(kws).size).toBe(kws.length)
  })

  it('never leaves a placeholder in a keyword', () => {
    for (const type of Object.keys(KEYWORD_MAP) as KeywordPageType[]) {
      for (const kw of keywordsFor(type)) expect(kw).not.toMatch(/\[|\]/)
    }
  })
})

describe('inCountry', () => {
  it('adds "the" for the countries that take it, and only those', () => {
    expect(inCountry('United States')).toBe('the United States')
    expect(inCountry('United Kingdom')).toBe('the United Kingdom')
    expect(inCountry('Netherlands')).toBe('the Netherlands')
    expect(inCountry('Canada')).toBe('Canada')
    expect(inCountry('Germany')).toBe('Germany')
  })

  it('reads naturally in the country title', () => {
    expect(buildCountryTitle('United Kingdom', '£75k+')).toBe('High-Paying Jobs in the United Kingdom (£75k+) [2026]')
  })
})
