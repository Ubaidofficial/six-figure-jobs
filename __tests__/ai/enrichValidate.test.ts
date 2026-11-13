import type { AiEnrichOutput } from '@/lib/ai/aiEnrichPrompt'
import { claimedNumbers, validateEnrichment } from '@/lib/ai/enrichValidate'

const source = `
Senior Platform Engineer. You will design and run our Kubernetes and Terraform platform on AWS.
Responsibilities: own reliability for services used by 10,000 customers; mentor engineers.
Requirements: 5+ years of experience running production systems; strong Go or Python.
Compensation: $150,000 - $200,000 base salary, equity, health insurance and 401(k).
`
const good = (over: Partial<AiEnrichOutput> = {}): AiEnrichOutput => ({
  oneLiner: 'Own the reliability of a Kubernetes platform on AWS.',
  snippet: 'You will design and run the Kubernetes and Terraform platform and mentor other engineers on the team.',
  description: ['Design and run the Kubernetes platform on AWS', 'Mentor engineers across the team'],
  requirements: ['5+ years of experience running production systems', 'Strong Go or Python'],
  benefits: ['Equity and health insurance', '401(k)'],
  techStack: ['Kubernetes', 'Terraform', 'AWS', 'Go'],
  ...over,
})

describe('validateEnrichment', () => {
  it('passes a faithful rewrite, including "$150k" for "$150,000"', () => {
    expect(validateEnrichment(good({ benefits: ['Base salary up to $200k', 'Equity'] }), source)).toEqual({ ok: true, problems: [] })
  })

  it('flags a year count or salary that is not in the posting', () => {
    const r = validateEnrichment(good({ requirements: ['10+ years of experience', 'Strong Go'] }), source)
    expect(r.ok).toBe(false)
    expect(r.problems.join(' ')).toMatch(/number not in the posting: 10\+/)
    expect(validateEnrichment(good({ snippet: 'Earn $250k running the platform, mentoring other engineers on the team daily.' }), source).problems.join(' ')).toMatch(/250k/)
  })

  it('flags tech that the posting never names, and benefits when the posting has none', () => {
    expect(validateEnrichment(good({ techStack: ['Kubernetes', 'Rust'] }), source).problems).toContain('tech not in the posting: Rust')
    const noBenefits = 'Responsibilities: build APIs. Requirements: 3 years of experience with Go.'
    expect(validateEnrichment(good({ benefits: ['Unlimited PTO'], description: ['Build APIs', 'Ship daily'], requirements: ['3 years of experience with Go', 'Go'], techStack: ['Go'] }), noBenefits).problems).toContain(
      'benefits listed, but the posting mentions none',
    )
  })

  it('flags empty sections the posting has, and a too-short one-liner or snippet', () => {
    const r = validateEnrichment(good({ description: [], requirements: [], oneLiner: 'Short', snippet: 'Tiny' }), source)
    expect(r.problems).toEqual(expect.arrayContaining(['no responsibilities, but the posting lists them', 'no requirements, but the posting lists them', 'one-liner is too short', 'snippet is too short']))
  })
})

describe('claimedNumbers', () => {
  it('keeps numbers that make a claim and ignores bare single digits', () => {
    expect(claimedNumbers('3 bullets, 5+ years, $150k, 10,000 users, 40%, 2 of them')).toEqual([
      { digits: '5', suffix: '+' },
      { digits: '150', suffix: 'k' },
      { digits: '10000', suffix: '' },
      { digits: '40', suffix: '%' },
    ])
  })
})
