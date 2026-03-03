import {
  QUALITY_MIN_DESCRIPTION_CHARS,
  evaluateJobIndexability,
} from '../../lib/jobs/qualityGate'

const baseJob = {
  id: 'ats:greenhouse:123',
  title: 'Senior Backend Engineer',
  company: 'Acme',
  companyId: 'company_1',
  locationRaw: 'Remote - US',
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

describe('evaluateJobIndexability', () => {
  it('accepts a complete high-quality six-figure job', () => {
    const result = evaluateJobIndexability(baseJob)
    expect(result).toEqual({ indexable: true, reason: 'ok' })
  })

  it('rejects thin content when description and AI text are both insufficient', () => {
    const result = evaluateJobIndexability({
      ...baseJob,
      descriptionHtml: '<p>short</p>',
      aiSnippet: 'tiny',
      aiOneLiner: 'small',
    })

    expect(result.indexable).toBe(false)
    expect(result.reason).toBe('thin_content')
  })

  it('rejects jobs missing location signals', () => {
    const result = evaluateJobIndexability({
      ...baseJob,
      locationRaw: null,
      countryCode: null,
      citySlug: null,
      remote: false,
      remoteMode: null,
    })

    expect(result.indexable).toBe(false)
    expect(result.reason).toBe('missing_location')
  })

  it('rejects below-threshold annual salaries', () => {
    const result = evaluateJobIndexability({
      ...baseJob,
      minAnnual: BigInt(70_000),
      maxAnnual: BigInt(90_000),
    })

    expect(result.indexable).toBe(false)
    expect(result.reason).toBe('below_threshold')
  })

  it('rejects unsupported currencies for thresholding', () => {
    const result = evaluateJobIndexability({
      ...baseJob,
      currency: 'JPY',
      minAnnual: BigInt(20_000_000),
      maxAnnual: BigInt(22_000_000),
    })

    expect(result.indexable).toBe(false)
    expect(result.reason).toBe('unsupported_currency')
  })
})
