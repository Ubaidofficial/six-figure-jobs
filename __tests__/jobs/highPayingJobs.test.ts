jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { highPayingFaq, rankRolesByPay } from '@/lib/jobs/highPayingJobs'
import { roleLabelFor } from '@/lib/roles/relatedRoles'

const listings = (roleSlug: string, n: number, salary: number) =>
  Array.from({ length: n }, () => ({ roleSlug, minAnnual: salary - 10_000, maxAnnual: salary + 10_000 }))

describe('rankRolesByPay', () => {
  it('ranks role pages by median, folding seniority in and leaving out thin roles', () => {
    const rows = [
      ...listings('software-engineer', 15, 180_000),
      ...listings('senior-software-engineer', 10, 240_000), // counts toward Software Engineer
      ...listings('engineering-manager', 25, 260_000),
      ...listings('data-analyst', 5, 300_000), // too few listings to rank
      ...listings('other', 40, 400_000), // catch-all, no role page
    ]
    const ranked = rankRolesByPay(rows)
    expect(ranked.map((r) => [r.slug, r.listings])).toEqual([
      ['engineering-manager', 25],
      ['software-engineer', 25],
    ])
    expect(ranked[0].median).toBe(260_000)
  })
})

describe('highPayingFaq', () => {
  it('answers from the ranked numbers', () => {
    const roles = [
      { slug: 'a', label: 'Sales Director', median: 320_000, p25: 250_000, p75: 380_000, listings: 114 },
      { slug: 'b', label: 'Engineering Manager', median: 258_000, p25: 220_000, p75: 300_000, listings: 348 },
      { slug: 'c', label: 'Machine Learning Engineer', median: 245_800, p25: 208_000, p75: 280_000, listings: 248 },
    ]
    const faq = highPayingFaq(roles, 18218)
    expect(faq[0].answer).toContain('Sales Director ($320k), Engineering Manager ($258k) and Machine Learning Engineer ($246k)')
    expect(faq[1].answer).toContain('Engineering Manager (348 open listings, median $258k)')
    expect(faq[2].answer).toContain('18,218 live US-dollar listings')
  })

  it('skips the ranking questions without enough roles', () => {
    expect(highPayingFaq([], 0).map((q) => q.question)).toEqual(['How are these salaries calculated?', 'Do all of these jobs pay six figures?'])
  })
})

describe('roleLabelFor', () => {
  it('keeps acronyms in capitals', () => {
    expect(roleLabelFor('hr-director')).toBe('HR Director')
    expect(roleLabelFor('vp-of-sales')).toBe('VP Of Sales')
  })
})
