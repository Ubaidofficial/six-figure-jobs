import { buildIndexableJobJsonLd } from '../../lib/seo/jobJsonLd'
import { QUALITY_MIN_DESCRIPTION_CHARS, evaluateJobIndexability } from '../../lib/jobs/qualityGate'

// A complete six-figure job that passes the quality gate (the same shape as __tests__/guards/qualityGate.test.ts).
const now = new Date()
const job: any = {
  id: 'ats:greenhouse:123',
  title: 'Senior Backend Engineer',
  company: 'Acme',
  companyId: 'company_1',
  companyRef: null,
  locationRaw: 'Remote - US',
  countryCode: 'US',
  remote: true,
  remoteMode: 'remote',
  descriptionHtml: `<p>${'We build backend services and own them in production. '.repeat(Math.ceil(QUALITY_MIN_DESCRIPTION_CHARS / 40))}</p>`,
  aiSnippet: null,
  aiOneLiner: null,
  salaryValidated: true,
  salaryConfidence: 95,
  minAnnual: BigInt(120000),
  maxAnnual: BigInt(180000),
  currency: 'USD',
  isExpired: false,
  lastSeenAt: now,
  postedAt: now,
  createdAt: now,
  updatedAt: now,
}

describe('buildIndexableJobJsonLd', () => {
  it('gives the JobPosting for a page the quality gate lets Google index', () => {
    expect(evaluateJobIndexability(job).indexable).toBe(true)
    expect(buildIndexableJobJsonLd(job)).toMatchObject({ '@type': 'JobPosting', title: 'Senior Backend Engineer' })
  })

  // Live audit 2026-11-23: a noindex job page (quality gate) still carried JobPosting, so markup and robots disagreed.
  it('gives nothing for a page the quality gate makes noindex', () => {
    const thin = { ...job, descriptionHtml: '<p>short</p>', aiSnippet: null, aiOneLiner: null }
    expect(evaluateJobIndexability(thin).indexable).toBe(false)
    expect(buildIndexableJobJsonLd(thin)).toBeNull()
  })
})
