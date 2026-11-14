import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  FRESHNESS,
  TITLE_MAX,
  buildCompaniesIndexDescription,
  buildCompaniesIndexTitle,
  buildCompanyPageDescription,
  buildCategoryTitle,
  buildCityTitle,
  buildCountryTitle,
  buildSalaryGuideTitle,
  buildSkillTitle,
  buildCompanyPageTitle,
  buildDescription,
  buildHomeDescription,
  buildJobsHubDescription,
  buildJobsHubTitle,
  buildListingDescription,
  buildListingTitle,
  buildRoleDescription,
  buildSalaryTierDescription,
  buildSalaryTierTitle,
  countryFlag,
  fitTitle,
  freshnessClosing,
  titleYearTag,
  truncateAtWord,
} from '../../lib/seo/metaText'
import { fitTitle as fitJobTitle } from '../../lib/seo/jobMeta'
import { SEARCH_ROLE_OPTIONS } from '../../lib/roles/searchRoles'
import { CITY_TARGETS, INDUSTRY_TARGETS, SKILL_TARGETS, STATE_TARGETS } from '../../lib/seo/pseoTargets'
import { JOB_CATEGORY_MAP } from '../../lib/seo/jobCategories'
import { SALARY_TIERS } from '../../lib/jobs/salaryTiers'

// The title ends with the current year, so pin the clock.
beforeAll(() => {
  jest.useFakeTimers({ now: new Date('2026-11-14T12:00:00Z') })
})
afterAll(() => {
  jest.useRealTimers()
})

const ROLES = Array.from(new Set(SEARCH_ROLE_OPTIONS.map((r) => r.label)))
const COUNTS = [0, 1, 7, 72, 1234, 12345]
const LONG_NAMES = [
  'Anduril Industries',
  'Palo Alto Networks International Holdings',
  'The Global Infrastructure and Technology Consulting Partnership of America, Inc.',
  'Supercalifragilisticexpialidocious-Technologies-Incorporated-Worldwide-Limited',
]

/** A truncated string must end in an ellipsis after a whole word of the source text. */
function endsOnWholeWord(out: string, source: string) {
  if (!out.endsWith('…')) return true
  const body = out.slice(0, -1)
  return source.startsWith(body) && (source[body.length] === ' ' || source[body.length] === undefined)
}

describe('truncateAtWord', () => {
  it('returns short text unchanged', () => {
    expect(truncateAtWord('Hello world', 20)).toBe('Hello world')
  })

  it('cuts at a word boundary, never mid-word', () => {
    const src = 'Principal Machine Learning Infrastructure Engineer Jobs'
    const out = truncateAtWord(src, 30)
    expect(out.length).toBeLessThanOrEqual(30)
    expect(out).toBe('Principal Machine Learning…')
    expect(endsOnWholeWord(out, src)).toBe(true)
  })

  it('hard-cuts a single over-long word', () => {
    const out = truncateAtWord('A'.repeat(90), 40)
    expect(out.length).toBeLessThanOrEqual(40)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('fitTitle', () => {
  it('picks the first candidate that fits', () => {
    expect(fitTitle(['x'.repeat(70), 'short one', 'shorter'])).toBe('short one')
  })

  it('truncates the last candidate when nothing fits', () => {
    const out = fitTitle(['word '.repeat(30), 'word '.repeat(20)])
    expect(out.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(out.endsWith('word…')).toBe(true)
  })
})

describe('buildListingTitle', () => {
  it('ends with the year tag, then the brand', () => {
    expect(buildListingTitle({ topic: 'Java Jobs', qualifier: 'Paying $100k+' })).toBe(
      'Java Jobs Paying $100k+ [2026] | Six Figure Jobs',
    )
  })

  it('takes the year from the clock', () => {
    expect(titleYearTag()).toBe('[2026]')
    expect(titleYearTag(new Date('2027-01-02T00:00:00Z'))).toBe('[2027]')
  })

  it('never shows a job count', () => {
    for (const topic of ['Software Engineer Jobs', 'Python Jobs']) {
      expect(buildListingTitle({ topic, qualifier: 'Paying $100k+' })).not.toMatch(/\d,?\d* (Roles|Jobs)/)
    }
  })

  it('puts a flag first, counts it as two characters and drops the brand to fit', () => {
    const t = buildListingTitle({ topic: 'High-Paying Jobs in Austin', qualifier: '($100k+)', flag: countryFlag('US') })
    expect(t).toBe('🇺🇸 High-Paying Jobs in Austin ($100k+) [2026]')
    expect([...t].length).toBeLessThanOrEqual(TITLE_MAX)
  })

  it('joins a qualifier that starts with a colon without a space', () => {
    expect(buildListingTitle({ topic: 'Jobs Paying $100k+', qualifier: ': Browse by Role' })).toBe(
      'Jobs Paying $100k+: Browse by Role [2026] | Six Figure Jobs',
    )
  })

  it('never exceeds 60 characters for any role or city', () => {
    const cities = CITY_TARGETS.map((c) => c.label)
    ROLES.forEach((role, i) => {
      const titles = [
        buildListingTitle({ topic: `${role} Jobs`, qualifier: 'Paying $100k+' }),
        buildListingTitle({ topic: `Remote ${role} Jobs in ${cities[i % cities.length]}`, qualifier: 'Paying $100k+' }),
        buildListingTitle({ topic: `${role} Python Jobs`, qualifier: 'Paying $100k+' }),
      ]
      for (const t of titles) expect([...t].length).toBeLessThanOrEqual(TITLE_MAX)
    })
  })

  it('truncates a very long topic at a word boundary', () => {
    const topic = 'Senior Principal Distinguished Staff Machine Learning Infrastructure Platform Engineer Jobs in San Francisco Bay Area'
    const out = buildListingTitle({ topic, qualifier: 'Paying $100k+' })
    expect(out.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(out.endsWith('…')).toBe(true)
    expect(endsOnWholeWord(out, topic)).toBe(true)
  })

  it('drops the brand first, then the qualifier, then the year tag', () => {
    const withBrand = buildListingTitle({ topic: 'Java Jobs', qualifier: 'Paying $100k+' })
    expect(withBrand.endsWith('| Six Figure Jobs')).toBe(true)
    const noBrand = buildListingTitle({ topic: 'Machine Learning Engineer Jobs', qualifier: 'Paying $100k+' })
    expect(noBrand).toBe('Machine Learning Engineer Jobs Paying $100k+ [2026]')
    const noQualifier = buildListingTitle({
      topic: 'DevOps & Site Reliability Engineer (SRE) Jobs',
      qualifier: 'Paying $100k+',
    })
    expect(noQualifier).toBe('DevOps & Site Reliability Engineer (SRE) Jobs [2026]')
    for (const t of [noBrand, noQualifier]) expect(t.length).toBeLessThanOrEqual(TITLE_MAX)
  })
})

describe('remote role title (as built by /remote/[role])', () => {
  it('starts with "Remote <role> Jobs" and never exceeds 60 characters', () => {
    for (const role of ROLES) {
      const t = buildListingTitle({ topic: `Remote ${role} Jobs`, qualifier: 'Paying $100k+' })
      expect([...t].length).toBeLessThanOrEqual(TITLE_MAX)
      expect(t.startsWith(`Remote ${role.slice(0, 12)}`)).toBe(true)
    }
  })
})

describe('role listing description', () => {
  it('is 130-155 characters, leads with the role and ends with the job count for every role', () => {
    for (const role of ROLES) {
      for (const [total, avg] of [[72, 199_000], [1234, null], [3, 150_500]] as const) {
        const d = buildRoleDescription(role, total, avg)
        expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
        expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
        expect(d.startsWith(`${role} jobs`)).toBe(true)
        expect(d.endsWith(`${total.toLocaleString()} open roles.`)).toBe(true)
      }
    }
  })

  it('matches the example from the live site', () => {
    expect(buildRoleDescription('Software Engineer', 72, 199_000)).toBe(
      'Software Engineer jobs paying $100k+, ~$199k average USD salary where listed. Salary shown upfront. Updated daily on Six Figure Jobs: 72 open roles.',
    )
  })

  it('only mentions an average when the page computed one', () => {
    expect(buildRoleDescription('Data Engineer', 10, null)).not.toMatch(/average/)
    expect(buildRoleDescription('Data Engineer', 10, 180_000)).toMatch(/~\$180k average USD/)
  })

  it('is unique per role', () => {
    const all = ROLES.map((r) => buildRoleDescription(r, 72, 199_000))
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('home description', () => {
  it('is 130-155 characters and ends with the live counts', () => {
    const d = buildHomeDescription(2813, 95)
    expect(d).toBe(
      'High-paying 6-figure jobs ($100k+) at top companies. Salary shown upfront. Updated daily on Six Figure Jobs: 2,813+ jobs at 95+ companies.',
    )
    expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(d.startsWith('High-paying 6-figure jobs')).toBe(true)
  })

  it('stays within limits for large counts', () => {
    const d = buildHomeDescription(123456, 12345)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })
})

describe('company page metadata', () => {
  it('leads with "<Company> Jobs", the way people search for an employer', () => {
    expect(buildCompanyPageTitle('Stripe')).toBe('Stripe Jobs Paying $100k+ [2026] | Six Figure Jobs')
    expect(buildCompanyPageTitle('OpenAI')).toBe('OpenAI Jobs Paying $100k+ [2026] | Six Figure Jobs')
  })

  it('never exceeds 60 characters, including very long company names', () => {
    const names = ['Stripe', 'Anduril Industries', ...LONG_NAMES]
    for (const name of names) {
      const t = buildCompanyPageTitle(name)
      expect(t.length).toBeLessThanOrEqual(TITLE_MAX)
      expect(t.startsWith(name.slice(0, 10))).toBe(true)
    }
  })

  it('cuts a long company name at a word boundary', () => {
    const name = 'The Global Infrastructure and Technology Consulting Partnership of America, Inc.'
    const t = buildCompanyPageTitle(name)
    expect(t.endsWith('…')).toBe(true)
    expect(endsOnWholeWord(t, `${name} Jobs`)).toBe(true)
  })

  it('builds a 130-155 character description from values the page computed', () => {
    const d = buildCompanyPageDescription('Stripe', 12, ['Engineering', 'Product', 'Data', 'Design'], '$310k')
    expect(d).toBe(
      '$100k+ jobs at Stripe. Highest listed pay $310k. Top roles: Engineering, Product, Data. Updated daily on Six Figure Jobs: 12 open roles.',
    )
    expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })

  it('does not invent figures when the page has no salary or roles', () => {
    const d = buildCompanyPageDescription('Acme', 3, [], null)
    expect(d).not.toMatch(/Highest|Top roles/)
    expect(d.startsWith('$100k+ jobs at Acme.')).toBe(true)
    expect(d.endsWith('3 open roles.')).toBe(true)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })

  it('stays within the limit for long company names and is unique per company', () => {
    const ds = LONG_NAMES.map((n) => buildCompanyPageDescription(n, 5, ['Engineering', 'Sales'], '$250k'))
    for (const d of ds) expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(new Set(ds).size).toBe(ds.length)
  })
})

describe('companies index description', () => {
  it('is 130-155 characters and says which companies it counts, next to every company hiring', () => {
    const d = buildCompaniesIndexDescription(402, 16684, 2557, 5)
    expect(d.startsWith('Companies with 5+ open $100k+ jobs, out of 2,557 companies hiring.')).toBe(true)
    expect(d.endsWith('402 companies, 16,684 jobs.')).toBe(true)
    expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })

  it('stays within limits with large counts', () => {
    const d = buildCompaniesIndexDescription(12345, 123456, 123456, 5)
    expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })

  it('leaves out the site-wide count when it adds nothing', () => {
    expect(buildCompaniesIndexDescription(402, 16684, 402, 5)).not.toContain('out of')
    expect(buildCompaniesIndexDescription(402, 16684, 0, 5)).not.toContain('out of')
  })

  it('works without counts', () => {
    expect(buildCompaniesIndexDescription(0, 0, 0, 5).length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })
})

describe('companies index title', () => {
  it('says which companies it lists and ends with the year tag', () => {
    expect(buildCompaniesIndexTitle()).toBe('Top Companies Hiring $100k+ Jobs [2026] | Six Figure Jobs')
  })

  it('stays within the title limit', () => {
    expect(buildCompaniesIndexTitle().length).toBeLessThanOrEqual(TITLE_MAX)
  })
})

describe('geo / skill / industry listing descriptions (same leads as the pages)', () => {
  const count = 1234
  const families: Record<string, string[]> = {
    city: CITY_TARGETS.map((c) =>
      buildListingDescription(`$100k+ jobs in ${c.label}.`, [['Remote, hybrid and on-site roles.']], count),
    ),
    state: STATE_TARGETS.map((s) =>
      buildListingDescription(`$100k+ jobs in ${s.name}.`, [['Remote, hybrid and on-site roles.']], count),
    ),
    skill: SKILL_TARGETS.map((s) =>
      buildListingDescription(`$100k+ ${s.label} jobs.`, [['High-paying roles at top tech companies.']], count),
    ),
    industry: INDUSTRY_TARGETS.map((i) =>
      buildListingDescription(
        `$100k+ ${i.label} jobs.`,
        [['Six-figure roles at top companies, with remote, hybrid and on-site options.', 'Six-figure roles at top companies.']],
        count,
      ),
    ),
    category: Object.values(JOB_CATEGORY_MAP).map((c) =>
      buildListingDescription(`$100k+ ${c.label.toLowerCase()} jobs.`, [['Remote, hybrid and on-site roles.']], count),
    ),
  }

  for (const [name, list] of Object.entries(families)) {
    it(`${name}: within 155 characters, ends with the job count, unique per page`, () => {
      expect(list.length).toBeGreaterThan(0)
      for (const d of list) {
        expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
        expect(d.endsWith(freshnessClosing(count))).toBe(true)
      }
      expect(new Set(list).size).toBe(list.length)
    })
  }

  it('city/state/skill/industry/category descriptions are at least 130 characters', () => {
    for (const list of Object.values(families)) for (const d of list) expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
  })

  it('remote role and role x city descriptions are 130-155 characters for every role', () => {
    for (const role of ROLES) {
      const remote = buildListingDescription(`remote ${role} jobs paying $100k+.`, [
        ['Verified six-figure salaries at top companies.'],
      ], count)
      const roleCity = buildListingDescription(`$100k+ ${role} jobs in San Francisco.`, [
        ['Remote, hybrid and on-site roles.'],
      ], count)
      for (const d of [remote, roleCity]) {
        expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
        expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
      }
    }
  })
})

describe('countryFlag', () => {
  it('turns a two-letter country code into a flag emoji', () => {
    expect(countryFlag('US')).toBe('🇺🇸')
    expect(countryFlag('gb')).toBe('🇬🇧')
    expect(countryFlag('UK')).toBe('🇬🇧')
    expect(countryFlag('DE')).toBe('🇩🇪')
  })

  it('returns nothing for anything that is not a country code', () => {
    for (const bad of [null, undefined, '', 'USA', 'U', '12', 'Remote']) expect(countryFlag(bad)).toBe('')
  })
})

describe('buildDescription', () => {
  it('skips slots that do not fit and cuts an over-long lead at a word boundary', () => {
    expect(buildDescription('Lead.', [['x'.repeat(200)]])).toBe(`Lead. ${FRESHNESS}`)
    const out = buildDescription('word '.repeat(60).trim() + '.', [])
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('job page fitTitle (jobMeta)', () => {
  it('cuts very long role names at a word boundary, keeps the salary and stays within 60 characters', () => {
    const role = 'Senior Principal Distinguished Staff Machine Learning Infrastructure Platform Reliability Engineer'
    const out = fitJobTitle(role, 'Acme Robotics', '$200k–$250k/yr')
    expect(out.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(out.endsWith(' — $200k–$250k')).toBe(true)
    const rolePart = out.slice(0, -' — $200k–$250k'.length)
    expect(rolePart.endsWith('…')).toBe(true)
    expect(endsOnWholeWord(rolePart, role)).toBe(true)
  })

  it('stays within 60 characters for long company names too', () => {
    for (const name of LONG_NAMES) {
      expect(fitJobTitle('Staff Engineer', name, null).length).toBeLessThanOrEqual(TITLE_MAX)
      expect(fitJobTitle('Staff Engineer', name, '$200k–$250k/yr').length).toBeLessThanOrEqual(TITLE_MAX)
    }
  })
})

describe('/jobs hub title and description', () => {
  it('targets "jobs paying $100k+", not the home page\'s "six figure jobs", and ends the description with the live count', () => {
    expect(buildJobsHubTitle()).toBe('Jobs Paying $100k+: Browse by Role, Country & Remote [2026]')
    expect(buildJobsHubTitle()).not.toMatch(/six.figure/i)
    expect(buildJobsHubDescription(3874).startsWith('High-paying $100k+ jobs open now.')).toBe(true)
    expect(buildJobsHubDescription(3874).endsWith('3,874 open roles.')).toBe(true)
    expect(buildJobsHubDescription(3874)).not.toMatch(/tech/i)
  })

  it('stays within the limits, with or without a page suffix', () => {
    for (const suffix of ['', ' (Page 2)', ' (Page 12)']) {
      expect([...buildJobsHubTitle(suffix)].length).toBeLessThanOrEqual(TITLE_MAX)
    }
    for (const count of [null, 0, 1, 7, 72, 1234, 12345, 123456]) {
      const d = buildJobsHubDescription(count)
      expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
      expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    }
  })

  it('has no count in the description when it is unknown or zero', () => {
    expect(buildJobsHubDescription(0).startsWith('High-paying $100k+ jobs open now.')).toBe(true)
    expect(buildJobsHubDescription(null)).not.toMatch(/open roles/)
  })
})

describe('salary tier title and description', () => {
  it('stays within the limits for every tier and count', () => {
    for (const tier of Object.values(SALARY_TIERS)) {
      expect(buildSalaryTierTitle(tier.rangeLabel).length).toBeLessThanOrEqual(TITLE_MAX)
      for (const count of COUNTS) {
        const d = buildSalaryTierDescription(tier.rangeLabel, count)
        expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN - 20)
        expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
      }
    }
  })

  it('reads "jobs that pay <range> a year" and puts the live count last in the description', () => {
    const { rangeLabel } = SALARY_TIERS['100k-plus']
    expect(buildSalaryTierTitle(rangeLabel)).toBe(`Jobs That Pay ${rangeLabel} a Year [2026] | Six Figure Jobs`)
    expect(buildSalaryTierDescription(rangeLabel, 1234).startsWith(`Jobs that pay ${rangeLabel} a year, open now.`)).toBe(true)
    expect(buildSalaryTierDescription(rangeLabel, 1234).endsWith('1,234 open roles.')).toBe(true)
  })
})

describe('city and category titles', () => {
  const SALARY_LABELS = ['$100k+', '£75k+', '€80k+', 'C$120k+', 'A$140k+']

  it('start with the flag, end with the year tag and stay within the limit for every city and label', () => {
    for (const city of CITY_TARGETS) {
      for (const label of SALARY_LABELS) {
        expect([...buildCityTitle(city.label, label, city.countryCode)].length).toBeLessThanOrEqual(TITLE_MAX)
      }
    }
    expect(buildCityTitle('Austin', '$100k+', 'US')).toBe('🇺🇸 High-Paying Jobs in Austin ($100k+) [2026]')
    expect(buildCityTitle('Austin', '$100k+')).toBe('High-Paying Jobs in Austin ($100k+) [2026] | Six Figure Jobs')
  })

  it('country titles say high-paying, name the local floor and stay within the limit', () => {
    for (const country of ['United States', 'United Kingdom', 'Canada', 'Germany', 'Australia', 'United Arab Emirates']) {
      for (const label of SALARY_LABELS) {
        expect([...buildCountryTitle(country, label, 'GB')].length).toBeLessThanOrEqual(TITLE_MAX)
      }
    }
    expect(buildCountryTitle('Canada', 'C$120k+')).toBe('High-Paying Jobs in Canada (C$120k+) [2026]')
    expect(buildCountryTitle('Canada', 'C$120k+', 'CA')).toBe('🇨🇦 High-Paying Jobs in Canada (C$120k+) [2026]')
    expect(buildCountryTitle('United States', '$100k+', 'US')).toBe('🇺🇸 High-Paying Jobs in the United States ($100k+) [2026]')
  })

  it('skill titles match the role-page shape and stay within the limit', () => {
    for (const label of ['Python', 'AWS', 'Machine Learning', 'Natural Language Processing', 'Kubernetes']) {
      expect(buildSkillTitle(label).length).toBeLessThanOrEqual(TITLE_MAX)
    }
    expect(buildSkillTitle('Python')).toBe('Python Jobs Paying $100k+ [2026] | Six Figure Jobs')
  })

  it('category titles match the role-page shape and stay within the limit', () => {
    for (const cfg of Object.values(JOB_CATEGORY_MAP)) {
      expect(buildCategoryTitle(cfg.label).length).toBeLessThanOrEqual(TITLE_MAX)
    }
    expect(buildCategoryTitle('Engineering')).toBe('Engineering Jobs Paying $100k+ [2026] | Six Figure Jobs')
  })
})

describe('salary guide titles', () => {
  it('lead with "<Role> Salary" and the median when there is one', () => {
    expect(buildSalaryGuideTitle('Software Engineer', '$100k+', 229_400)).toBe('Software Engineer Salary: $229k Median [2026]')
    expect(buildSalaryGuideTitle('Backend Engineer', '$100k+', null)).toBe('Backend Engineer Salary Guide ($100k+) [2026]')
  })

  it('stay within the limit for long role names', () => {
    for (const role of ['Machine Learning Engineer', 'Senior Site Reliability Engineer', 'Principal Machine Learning Infrastructure Engineer']) {
      for (const median of [null, 95_000, 252_000, 1_250_000]) {
        expect(buildSalaryGuideTitle(role, '$400k+', median).length).toBeLessThanOrEqual(TITLE_MAX)
      }
    }
    expect(buildSalaryGuideTitle('Machine Learning Engineer', '$100k+', 252_000)).toBe('Machine Learning Engineer Salary: $252k Median [2026]')
  })
})
