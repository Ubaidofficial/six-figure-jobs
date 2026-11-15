import { KEYWORD_MAP, keywordsFor, type KeywordPageType } from '../../lib/seo/keywordMap'
import {
  buildCategoryTitle,
  buildCityTitle,
  buildCompaniesIndexDescription,
  buildCompanyPageDescription,
  buildCompanyPageTitle,
  buildCompaniesIndexTitle,
  buildCountryTitle,
  buildHomeDescription,
  buildJobsHubDescription,
  buildJobsHubTitle,
  buildListingTitle,
  buildRoleDescription,
  buildSalaryGuideTitle,
  buildSalaryTierDescription,
  buildSalaryTierTitle,
  buildSkillTitle,
  DESCRIPTION_MAX,
  TITLE_MAX,
} from '../../lib/seo/metaText'

// Titles and descriptions carry the month and year, so pin the clock.
beforeAll(() => {
  jest.useFakeTimers({ now: new Date('2026-11-14T12:00:00Z') })
})
afterAll(() => {
  jest.useRealTimers()
})

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
      expect([...title].length).toBeLessThanOrEqual(TITLE_MAX)
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

// Real description builders, one or more per page type that has one (the other page types build theirs inline).
// Built inside the tests, after the clock is pinned.
const DESCRIPTION_TYPES = ['home', 'jobsHub', 'role', 'salaryTier', 'companies', 'company'] as const
function descriptionsFor(type: (typeof DESCRIPTION_TYPES)[number]): string[] {
  switch (type) {
    case 'home':
      return [buildHomeDescription(2813, 95), buildHomeDescription(123456, 12345)]
    case 'jobsHub':
      return [buildJobsHubDescription(3874), buildJobsHubDescription(null)]
    case 'role':
      return [
        buildRoleDescription('Software Engineer', 72, 199_000),
        buildRoleDescription('DevOps & Site Reliability Engineer (SRE)', 1234, null),
      ]
    case 'salaryTier':
      return [buildSalaryTierDescription('$100k–$199k', 1234), buildSalaryTierDescription('$400k+', 0)]
    case 'companies':
      return [buildCompaniesIndexDescription(402, 16684, 2557, 5)]
    case 'company':
      return [
        buildCompanyPageDescription('Stripe', 12, ['Engineering', 'Product'], '$310k'),
        buildCompanyPageDescription('Acme', 3, [], null),
      ]
  }
}

describe('descriptions keep the page keywords', () => {
  it.each(DESCRIPTION_TYPES)('%s descriptions carry their keyword fragments, the month and year, and fit 155', (type) => {
    const { descHas } = KEYWORD_MAP[type]
    for (const d of descriptionsFor(type)) {
      for (const fragment of descHas) expect(norm(d)).toContain(fragment)
      expect(d).toContain('(Nov 2026)')
      expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    }
  })

  it('every page type lists at least one description fragment, in lowercase', () => {
    for (const kw of Object.values(KEYWORD_MAP)) {
      expect(kw.descHas.length).toBeGreaterThan(0)
      for (const f of kw.descHas) expect(f).toBe(f.toLowerCase())
    }
  })
})

describe('country names in titles', () => {
  it('say "the UK" and "the US", the way people search for them', () => {
    expect(buildCountryTitle('United Kingdom', '£75k+')).toBe('High-Paying Jobs in the UK (£75k+) [Nov 2026]')
    expect(buildCountryTitle('United States', '$100k+')).toBe('High-Paying Jobs in the US ($100k+) [Nov 2026]')
  })
})
