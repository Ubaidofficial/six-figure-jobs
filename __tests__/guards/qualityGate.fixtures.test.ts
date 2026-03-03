import {
  dedupeIndexableJobs,
  evaluateJobIndexability,
  QUALITY_MIN_DESCRIPTION_CHARS,
} from '../../lib/jobs/qualityGate'
import {
  normalizeSalary,
  parseSalaryFromText,
  validateHighSalaryEligibility,
} from '../../lib/normalizers/salary'

type SalaryFixture = {
  name: string
  text: string
  source: 'salaryRaw' | 'descriptionText'
  expectValid: boolean
  expectReasons: string[]
}

const SALARY_FIXTURES: SalaryFixture[] = [
  { name: 'usd compact', text: 'Compensation: USD 100k base', source: 'salaryRaw', expectValid: true, expectReasons: ['ok'] },
  { name: 'usd comma number', text: 'Salary range: USD 100,000 annual', source: 'salaryRaw', expectValid: true, expectReasons: ['ok'] },
  { name: 'usd plain number', text: 'Guaranteed pay 100000 USD', source: 'salaryRaw', expectValid: true, expectReasons: ['ok'] },
  { name: 'gbp compact', text: 'Base salary £100k', source: 'salaryRaw', expectValid: true, expectReasons: ['ok'] },
  { name: 'eur compact', text: 'Compensation €120k', source: 'salaryRaw', expectValid: true, expectReasons: ['ok'] },
  { name: 'range crossing threshold', text: 'Pay range: 80k-120k USD', source: 'salaryRaw', expectValid: true, expectReasons: ['ok'] },
  { name: 'hourly annualized pass', text: 'Rate: USD 60 per hour', source: 'salaryRaw', expectValid: true, expectReasons: ['ok'] },
  { name: 'hourly annualized fail', text: 'Rate: USD 35 per hour', source: 'salaryRaw', expectValid: false, expectReasons: ['below_threshold'] },
  { name: 'ote base plus commission', text: 'OTE $110k ($90k base + $20k commission)', source: 'descriptionText', expectValid: false, expectReasons: ['bad_range', 'ambiguous'] },
  { name: 'missing salary text', text: 'Competitive compensation package.', source: 'descriptionText', expectValid: false, expectReasons: ['bad_range', 'ambiguous'] },
  { name: 'ambiguous dollar only', text: 'Compensation up to $100k', source: 'salaryRaw', expectValid: false, expectReasons: ['ambiguous', 'bad_range'] },
  { name: 'below threshold', text: 'Salary: USD 95k', source: 'salaryRaw', expectValid: false, expectReasons: ['below_threshold'] },
  { name: 'high threshold pass', text: 'Base salary USD 400k+', source: 'salaryRaw', expectValid: true, expectReasons: ['ok'] },
  { name: 'range with comma groups', text: 'USD 120,000 - 160,000', source: 'salaryRaw', expectValid: true, expectReasons: ['ok'] },
]

const baseJob = {
  id: 'ats:test:1',
  title: 'Senior Backend Engineer',
  roleSlug: 'backend-engineer',
  company: 'Acme',
  companyId: 'company_1',
  locationRaw: 'Remote - US',
  citySlug: null,
  countryCode: 'US',
  remote: true,
  remoteMode: 'remote',
  descriptionHtml: `<p>${'A'.repeat(QUALITY_MIN_DESCRIPTION_CHARS)}</p>`,
  aiSnippet: null,
  aiOneLiner: null,
  salaryValidated: true,
  salaryConfidence: 95,
  minAnnual: BigInt(120000),
  maxAnnual: BigInt(180000),
  currency: 'USD',
  isExpired: false,
}

const QUALITY_GATE_FIXTURES: Array<{
  name: string
  job: Record<string, unknown>
  expectIndexable: boolean
  expectReason: string
}> = [
  { name: 'happy path', job: { ...baseJob, id: 'ats:test:ok' }, expectIndexable: true, expectReason: 'ok' },
  { name: 'missing id', job: { ...baseJob, id: '' }, expectIndexable: false, expectReason: 'missing_id' },
  { name: 'missing title', job: { ...baseJob, title: 'x' }, expectIndexable: false, expectReason: 'missing_title' },
  { name: 'missing company', job: { ...baseJob, company: '', companyId: '' }, expectIndexable: false, expectReason: 'missing_company' },
  { name: 'missing location', job: { ...baseJob, remote: false, remoteMode: null, countryCode: null, citySlug: null, locationRaw: '' }, expectIndexable: false, expectReason: 'missing_location' },
  { name: 'salary not validated', job: { ...baseJob, salaryValidated: false }, expectIndexable: false, expectReason: 'salary_not_validated' },
  { name: 'salary low confidence', job: { ...baseJob, salaryConfidence: 20 }, expectIndexable: false, expectReason: 'salary_low_confidence' },
  { name: 'below salary threshold', job: { ...baseJob, minAnnual: BigInt(70000), maxAnnual: BigInt(95000) }, expectIndexable: false, expectReason: 'below_threshold' },
  { name: 'unsupported currency', job: { ...baseJob, currency: 'JPY', minAnnual: BigInt(20_000_000), maxAnnual: BigInt(24_000_000) }, expectIndexable: false, expectReason: 'unsupported_currency' },
  { name: 'thin html and ai content', job: { ...baseJob, descriptionHtml: '<p>short</p>', aiSnippet: 'tiny', aiOneLiner: 'small' }, expectIndexable: false, expectReason: 'thin_content' },
  { name: 'expired job', job: { ...baseJob, isExpired: true }, expectIndexable: false, expectReason: 'expired' },
  { name: 'ai snippet satisfies content gate', job: { ...baseJob, descriptionHtml: '<p>n/a</p>', aiSnippet: 'A'.repeat(120), aiOneLiner: 'ok', id: 'ats:test:ai-snippet' }, expectIndexable: true, expectReason: 'ok' },
]

describe('quality gate fixture suite', () => {
  it(`validates ${SALARY_FIXTURES.length} salary parsing fixtures`, () => {
    for (const fixture of SALARY_FIXTURES) {
      const parsed = parseSalaryFromText(fixture.text)
      const normalized = normalizeSalary({
        min: parsed?.min ?? null,
        max: parsed?.max ?? null,
        currency: parsed?.currency ?? null,
        interval: parsed?.interval ?? 'year',
      })
      const result = validateHighSalaryEligibility({
        normalized,
        source: fixture.source,
        currencyAmbiguous: parsed?.currency == null,
      })

      expect(result.salaryValidated).toBe(fixture.expectValid)
      expect(fixture.expectReasons).toContain(result.salaryParseReason)
    }
  })

  it(`validates ${QUALITY_GATE_FIXTURES.length} indexability fixtures`, () => {
    for (const fixture of QUALITY_GATE_FIXTURES) {
      const result = evaluateJobIndexability(fixture.job)
      expect(result.indexable).toBe(fixture.expectIndexable)
      expect(result.reason).toBe(fixture.expectReason)
    }
  })

  it('dedupes near-identical indexable jobs so they do not all remain indexable in sitemap scope', () => {
    const fixtures = [
      {
        ...baseJob,
        id: 'dup-newest',
        externalId: 'job-1',
        postedAt: '2026-02-01T09:00:00.000Z',
        updatedAt: '2026-02-11T10:00:00.000Z',
      },
      {
        ...baseJob,
        id: 'dup-older',
        externalId: 'job-1b',
        postedAt: '2026-02-01T08:00:00.000Z',
        updatedAt: '2026-02-10T10:00:00.000Z',
      },
      {
        ...baseJob,
        id: 'dup-oldest',
        externalId: 'job-1c',
        postedAt: '2026-02-01T08:00:00.000Z',
        updatedAt: '2026-02-09T10:00:00.000Z',
      },
      {
        ...baseJob,
        id: 'unique-location',
        citySlug: 'toronto',
        countryCode: 'CA',
        locationRaw: 'Toronto, CA',
        postedAt: '2026-02-01T08:00:00.000Z',
        updatedAt: '2026-02-10T11:00:00.000Z',
      },
      {
        ...baseJob,
        id: 'unique-company',
        company: 'Globex',
        companyId: 'company_2',
        postedAt: '2026-02-01T08:00:00.000Z',
        updatedAt: '2026-02-10T12:00:00.000Z',
      },
      {
        ...baseJob,
        id: 'thin-content',
        descriptionHtml: '<p>tiny</p>',
        aiSnippet: 'none',
        aiOneLiner: 'n/a',
        postedAt: '2026-02-01T08:00:00.000Z',
        updatedAt: '2026-02-12T10:00:00.000Z',
      },
    ]

    const indexable = fixtures.filter((job) => evaluateJobIndexability(job).indexable)
    const deduped = dedupeIndexableJobs(indexable)
    const ids = deduped.map((job) => job.id).sort()

    expect(indexable).toHaveLength(5)
    expect(deduped).toHaveLength(3)
    expect(ids).toEqual(['dup-newest', 'unique-company', 'unique-location'])
  })
})
