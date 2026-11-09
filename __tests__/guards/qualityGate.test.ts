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
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
}

describe('evaluateJobIndexability', () => {
  it('accepts a complete high-quality six-figure job', () => {
    const result = evaluateJobIndexability(baseJob)
    expect(result).toEqual({ indexable: true, reason: 'ok' })
  })

  it('does not index a posting written in another language (English site, owner decision 2026-11-08)', () => {
    const german = `<p>${'Für unseren renommierten Partner suchen wir Sie in Festanstellung als Facharzt. Wir bieten Ihnen eine unbefristete Stelle und die Mitarbeiter sind mit der Klinik verbunden. '.repeat(4)}</p>`
    const english = `<p>${'We are looking for an engineer who will join our team and work with the platform. You will have experience with the tools. '.repeat(4)}</p>`
    expect(evaluateJobIndexability({ ...baseJob, descriptionHtml: german })).toEqual({ indexable: false, reason: 'non_english' })
    expect(evaluateJobIndexability({ ...baseJob, descriptionHtml: english })).toEqual({ indexable: true, reason: 'ok' })
  })

  describe('a way to apply (Google does not allow a job posting without one)', () => {
    const withApply = { ...baseJob, applyUrl: 'https://jobs.lever.co/acme/123' }

    it('indexes a job with a link to apply', () => {
      expect(evaluateJobIndexability(withApply)).toEqual({ indexable: true, reason: 'ok' })
      expect(evaluateJobIndexability({ ...baseJob, applyUrl: 'careers.acme.com/jobs/123' })).toEqual({ indexable: true, reason: 'ok' })
    })

    it.each([null, '', '   ', 'mailto:jobs@acme.com', 'not a url %%'])('does not index a job whose applyUrl is %j', (applyUrl) => {
      expect(evaluateJobIndexability({ ...baseJob, applyUrl })).toEqual({ indexable: false, reason: 'no_apply_url' })
    })

    it('does not mistake a caller that never loaded applyUrl for a job without a link', () => {
      expect('applyUrl' in baseJob).toBe(false)
      expect(evaluateJobIndexability(baseJob)).toEqual({ indexable: true, reason: 'ok' })
    })
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

  it('rejects stale jobs even when the rest of the page is high quality', () => {
    const result = evaluateJobIndexability({
      ...baseJob,
      lastSeenAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    })

    expect(result.indexable).toBe(false)
    expect(result.reason).toBe('stale_job')
  })

  it('rejects jobs with polluted board/sidebar description content', () => {
    const result = evaluateJobIndexability({
      ...baseJob,
      descriptionHtml:
        '<div>Similar Jobs</div><p>Showing</p><p>7</p><p>jobs</p><p>Analytics</p><p>$148,500 - $204,000</p>',
    })

    expect(result.indexable).toBe(false)
    expect(result.reason).toBe('polluted_description')
  })
})
