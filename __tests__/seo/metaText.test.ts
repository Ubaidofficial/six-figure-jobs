import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  FRESHNESS,
  TITLE_MAX,
  buildCompaniesIndexDescription,
  buildCompanyPageDescription,
  buildCategoryTitle,
  buildCityTitle,
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
  countPrefix,
  fitTitle,
  truncateAtWord,
} from '../../lib/seo/metaText'
import { fitTitle as fitJobTitle } from '../../lib/seo/jobMeta'
import { SEARCH_ROLE_OPTIONS } from '../../lib/roles/searchRoles'
import { CITY_TARGETS, INDUSTRY_TARGETS, SKILL_TARGETS, STATE_TARGETS } from '../../lib/seo/pseoTargets'
import { JOB_CATEGORY_MAP } from '../../lib/seo/jobCategories'
import { SALARY_TIERS } from '../../lib/jobs/salaryTiers'

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
  it('leads with the count and topic and ends with the brand', () => {
    expect(buildListingTitle({ topic: 'Software Engineer Jobs', count: 72, qualifier: 'Paying $100k+' })).toBe(
      '72 Software Engineer Jobs Paying $100k+ | Six Figure Jobs',
    )
  })

  it('omits the count when it is zero', () => {
    expect(buildListingTitle({ topic: 'Software Engineer Jobs', count: 0, qualifier: 'Paying $100k+' })).toBe(
      'Software Engineer Jobs Paying $100k+ | Six Figure Jobs',
    )
  })

  it('never exceeds 60 characters for any role, count or city', () => {
    const cities = CITY_TARGETS.map((c) => c.label)
    for (const role of ROLES) {
      for (const count of COUNTS) {
        const titles = [
          buildListingTitle({ topic: `${role} Jobs`, count, qualifier: 'Paying $100k+' }),
          buildListingTitle({ topic: `Remote ${role} Jobs in ${cities[count % cities.length]}`, count, qualifier: 'Paying $100k+' }),
          buildListingTitle({ topic: `${role} Python Jobs`, count, qualifier: 'Paying $100k+' }),
        ]
        for (const t of titles) expect(t.length).toBeLessThanOrEqual(TITLE_MAX)
      }
    }
  })

  it('truncates a very long topic at a word boundary', () => {
    const topic = 'Senior Principal Distinguished Staff Machine Learning Infrastructure Platform Engineer Jobs in San Francisco Bay Area'
    const out = buildListingTitle({ topic, count: 1234, qualifier: 'Paying $100k+' })
    expect(out.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(out.endsWith('…')).toBe(true)
    expect(endsOnWholeWord(out, `1,234 ${topic}`)).toBe(true)
  })

  it('keeps the brand last when it fits and drops it before dropping the qualifier', () => {
    const withBrand = buildListingTitle({ topic: 'Data Engineer Jobs', count: 12, qualifier: 'Paying $100k+' })
    expect(withBrand.endsWith('| Six Figure Jobs')).toBe(true)
    const noBrand = buildListingTitle({ topic: 'Machine Learning Engineer Jobs', count: 1234, qualifier: 'Paying $100k+' })
    expect(noBrand).toBe('1,234 Machine Learning Engineer Jobs Paying $100k+')
    expect(noBrand.length).toBeLessThanOrEqual(TITLE_MAX)
    const noQualifier = buildListingTitle({
      topic: 'DevOps & Site Reliability Engineer (SRE) Jobs',
      count: 1234,
      qualifier: 'Paying $100k+',
    })
    expect(noQualifier).toBe('1,234 DevOps & Site Reliability Engineer (SRE) Jobs')
    expect(noQualifier.length).toBeLessThanOrEqual(TITLE_MAX)
  })
})

describe('remote role title (candidates as used by /remote/[role])', () => {
  it('keeps the established wording when it fits and never exceeds 60 characters', () => {
    for (const role of ROLES) {
      for (const count of [1, 72, 12345]) {
        const c = count.toLocaleString()
        const t = fitTitle([
          `${c} Remote ${role} $100k+ Jobs | Six Figure Jobs`,
          `${c} Remote ${role} $100k+ Jobs`,
          `${c} Remote ${role} Jobs`,
        ])
        expect(t.length).toBeLessThanOrEqual(TITLE_MAX)
        if (`${c} Remote ${role} $100k+ Jobs | Six Figure Jobs`.length <= TITLE_MAX) {
          expect(t).toBe(`${c} Remote ${role} $100k+ Jobs | Six Figure Jobs`)
        }
      }
    }
  })
})

describe('role listing description', () => {
  it('is 130-155 characters, leads with the count and ends with the freshness phrase for every role', () => {
    for (const role of ROLES) {
      for (const [total, avg] of [[72, 199_000], [1234, null], [3, 150_500]] as const) {
        const d = buildRoleDescription(role, total, avg)
        expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
        expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
        expect(d.startsWith(`${total.toLocaleString()} ${role} jobs`)).toBe(true)
        expect(d.endsWith(FRESHNESS)).toBe(true)
      }
    }
  })

  it('matches the example from the live site', () => {
    expect(buildRoleDescription('Software Engineer', 72, 199_000)).toBe(
      '72 Software Engineer jobs paying $100k+, ~$199k average USD salary where listed. Salary shown upfront. Updated daily on Six Figure Jobs.',
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
  it('is 130-155 characters and uses the live counts', () => {
    const d = buildHomeDescription(2813, 95)
    expect(d).toBe(
      '2,813+ jobs paying $100k+ from 95+ companies. Salary shown upfront, no entry-level noise. Remote and on-site roles. Updated daily on Six Figure Jobs.',
    )
    expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(d.startsWith('2,813+ jobs paying $100k+ from 95+ companies.')).toBe(true)
    expect(d.endsWith(FRESHNESS)).toBe(true)
  })

  it('stays within limits for large counts', () => {
    const d = buildHomeDescription(123456, 12345)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })
})

describe('company page metadata', () => {
  it('keeps the established title when it fits', () => {
    expect(buildCompanyPageTitle('Stripe', 12)).toBe('Stripe $100k+ Jobs - 12 Open Positions | Six Figure Jobs')
  })

  it('never exceeds 60 characters, including very long company names', () => {
    const names = ['Stripe', 'Anduril Industries', ...LONG_NAMES]
    for (const name of names) {
      for (const count of [1, 12, 1234]) {
        const t = buildCompanyPageTitle(name, count)
        expect(t.length).toBeLessThanOrEqual(TITLE_MAX)
        expect(t.startsWith(name.slice(0, 10))).toBe(true)
      }
    }
  })

  it('cuts a long company name at a word boundary', () => {
    const name = 'The Global Infrastructure and Technology Consulting Partnership of America, Inc.'
    const t = buildCompanyPageTitle(name, 12)
    expect(t.endsWith('…')).toBe(true)
    expect(endsOnWholeWord(t, `${name} Jobs`)).toBe(true)
  })

  it('builds a 130-155 character description from values the page computed', () => {
    const d = buildCompanyPageDescription('Stripe', 12, ['Engineering', 'Product', 'Data', 'Design'], '$310k')
    expect(d).toBe(
      '12 $100k+ jobs at Stripe. Highest listed pay $310k. Top roles: Engineering, Product, Data. Salary shown upfront. Updated daily on Six Figure Jobs.',
    )
    expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })

  it('does not invent figures when the page has no salary or roles', () => {
    const d = buildCompanyPageDescription('Acme', 3, [], null)
    expect(d).not.toMatch(/Highest|Top roles/)
    expect(d.startsWith('3 $100k+ jobs at Acme.')).toBe(true)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })

  it('stays within the limit for long company names and is unique per company', () => {
    const ds = LONG_NAMES.map((n) => buildCompanyPageDescription(n, 5, ['Engineering', 'Sales'], '$250k'))
    for (const d of ds) expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(new Set(ds).size).toBe(ds.length)
  })
})

describe('companies index description', () => {
  it('is 130-155 characters with the live counts', () => {
    const d = buildCompaniesIndexDescription(1234, 5678)
    expect(d.startsWith('1,234 companies hiring for 5,678 $100k+ tech jobs.')).toBe(true)
    expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })

  it('works without counts', () => {
    expect(buildCompaniesIndexDescription(0, 0).length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })
})

describe('geo / skill / industry listing descriptions (same leads as the pages)', () => {
  const count = 1234
  const n = countPrefix(count)
  const families: Record<string, string[]> = {
    city: CITY_TARGETS.map((c) =>
      buildListingDescription(`${n}$100k+ jobs in ${c.label}.`, [['Remote, hybrid and on-site roles.']]),
    ),
    state: STATE_TARGETS.map((s) =>
      buildListingDescription(`${n}$100k+ jobs in ${s.name}.`, [['Remote, hybrid and on-site roles.']]),
    ),
    skill: SKILL_TARGETS.map((s) =>
      buildListingDescription(`${n}$100k+ ${s.label} jobs.`, [['High-paying roles at top tech companies.']]),
    ),
    industry: INDUSTRY_TARGETS.map((i) =>
      buildListingDescription(`${n}$100k+ ${i.label} jobs.`, [
        ['Six-figure roles at top companies, with remote, hybrid and on-site options.', 'Six-figure roles at top companies.'],
      ]),
    ),
    category: Object.values(JOB_CATEGORY_MAP).map((c) =>
      buildListingDescription(`${n}$100k+ ${c.label.toLowerCase()} jobs.`, [['Remote, hybrid and on-site roles.']]),
    ),
  }

  for (const [name, list] of Object.entries(families)) {
    it(`${name}: within 155 characters, ends with freshness, unique per page`, () => {
      expect(list.length).toBeGreaterThan(0)
      for (const d of list) {
        expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
        expect(d.endsWith(FRESHNESS)).toBe(true)
      }
      expect(new Set(list).size).toBe(list.length)
    })
  }

  it('city/state/skill/industry/category descriptions are at least 130 characters', () => {
    for (const list of Object.values(families)) for (const d of list) expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
  })

  it('remote role and role x city descriptions are 130-155 characters for every role', () => {
    for (const role of ROLES) {
      const remote = buildListingDescription(`${n}remote ${role} jobs paying $100k+.`, [
        ['Verified six-figure salaries at top companies.'],
      ])
      const roleCity = buildListingDescription(`${n}$100k+ ${role} jobs in San Francisco.`, [
        ['Remote, hybrid and on-site roles.'],
      ])
      for (const d of [remote, roleCity]) {
        expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
        expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
      }
    }
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
  it('leads with the live count and keeps the six-figure wording', () => {
    expect(buildJobsHubTitle(3874)).toBe('3,874 Six-Figure Tech Jobs — $100k+ Openings')
    expect(buildJobsHubDescription(3874).startsWith('3,874 $100k+ tech jobs open now.')).toBe(true)
  })

  it('stays within the limits for every count, with or without a page suffix', () => {
    for (const count of [null, 0, 1, 7, 72, 1234, 12345, 123456]) {
      expect(buildJobsHubTitle(count).length).toBeLessThanOrEqual(TITLE_MAX)
      expect(buildJobsHubTitle(count, ' (Page 12)').length).toBeLessThanOrEqual(TITLE_MAX)
      const d = buildJobsHubDescription(count)
      expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN)
      expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    }
  })

  it('has no count when it is unknown or zero', () => {
    expect(buildJobsHubTitle(null)).toBe('Six-Figure Tech Jobs — $100k+ Openings | Six Figure Jobs')
    expect(buildJobsHubTitle(0)).toBe('Six-Figure Tech Jobs — $100k+ Openings | Six Figure Jobs')
    expect(buildJobsHubDescription(0).startsWith('$100k+ tech jobs open now.')).toBe(true)
  })
})

describe('salary tier title and description', () => {
  it('stays within the limits for every tier and count', () => {
    for (const tier of Object.values(SALARY_TIERS)) {
      for (const count of COUNTS) {
        expect(buildSalaryTierTitle(tier.rangeLabel, count).length).toBeLessThanOrEqual(TITLE_MAX)
        const d = buildSalaryTierDescription(tier.rangeLabel, count)
        expect(d.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN - 20)
        expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
      }
    }
  })

  it('puts the live count first and names the range', () => {
    const { rangeLabel } = SALARY_TIERS['100k-plus']
    expect(buildSalaryTierTitle(rangeLabel, 1234).startsWith(`1,234 ${rangeLabel} Jobs`)).toBe(true)
    expect(buildSalaryTierDescription(rangeLabel, 1234).startsWith(`1,234 ${rangeLabel} jobs open now.`)).toBe(true)
    expect(buildSalaryTierTitle(rangeLabel, 0).startsWith(rangeLabel)).toBe(true)
  })
})

describe('city and category titles', () => {
  const SALARY_LABELS = ['$100k+', '£75k+', '€80k+', 'C$120k+', 'A$140k+']

  it('lead with the live count and stay within the limit for every city, label and count', () => {
    for (const city of CITY_TARGETS) {
      for (const label of SALARY_LABELS) {
        for (const count of COUNTS) {
          expect(buildCityTitle(city.label, label, count).length).toBeLessThanOrEqual(TITLE_MAX)
        }
      }
    }
    expect(buildCityTitle('Austin', '$100k+', 1234)).toBe('1,234 $100k+ Jobs in Austin | Six Figure Jobs')
    expect(buildCityTitle('Austin', '$100k+', 0)).toBe('$100k+ Jobs in Austin | Six Figure Jobs')
  })

  it('category titles match the role-page shape and stay within the limit', () => {
    for (const cfg of Object.values(JOB_CATEGORY_MAP)) {
      for (const count of COUNTS) {
        expect(buildCategoryTitle(cfg.label, count).length).toBeLessThanOrEqual(TITLE_MAX)
      }
    }
    expect(buildCategoryTitle('Engineering', 1420)).toBe('1,420 Engineering Jobs Paying $100k+ | Six Figure Jobs')
  })
})
