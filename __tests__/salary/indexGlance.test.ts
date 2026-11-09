import { MIN_LISTINGS } from '../../lib/jobs/salarySnapshot'
import { formatMoneyShort, glanceRows, salaryFaq } from '../../lib/salary/indexGlance'
import type { RoleMedian } from '../../lib/salary/indexMedians'

const GUIDES = [
  { slug: 'software-engineer', label: 'Software Engineer salary' },
  { slug: 'product-manager', label: 'Product Manager salary' },
  { slug: 'data-engineer', label: 'Data Engineer salary' },
  { slug: 'designer', label: 'Designer salary' },
]
const stat = (median: number | null, listings = 30): RoleMedian => ({
  listings,
  median,
  p25: median == null ? null : median - 20_000,
  p75: median == null ? null : median + 25_000,
})
const medians = (entries: Array<[string, RoleMedian]>) => new Map(entries)

describe('glanceRows', () => {
  it('keeps only roles with a median, highest first, with the role name without "salary"', () => {
    const rows = glanceRows(
      medians([
        ['software-engineer', stat(180_000)],
        ['product-manager', stat(210_000)],
        ['data-engineer', stat(null, 4)],
      ]),
      GUIDES,
    )
    expect(rows.map((r) => [r.name, r.median])).toEqual([
      ['Product Manager', 210_000],
      ['Software Engineer', 180_000],
    ])
    expect(rows[0]).toMatchObject({ slug: 'product-manager', p25: 190_000, p75: 235_000, listings: 30 })
  })

  it('is empty when the lookup failed', () => {
    expect(glanceRows(null, GUIDES)).toEqual([])
  })
})

describe('salaryFaq', () => {
  const rows = glanceRows(
    medians([
      ['software-engineer', stat(180_000)],
      ['product-manager', stat(210_000)],
      ['designer', stat(150_000)],
    ]),
    GUIDES,
  )

  it('names the highest and lowest paying role with their medians', () => {
    const first = salaryFaq(rows)[0]
    expect(first.question).toBe('Which tech roles pay the most on Six Figure Jobs?')
    expect(first.answer).toContain('3 roles')
    expect(first.answer).toContain('Product Manager is highest at $210k')
    expect(first.answer).toContain('Designer is lowest at $150k')
  })

  it('leaves the ranking question out when every median is the same (nothing to rank)', () => {
    const tied = glanceRows(medians([['software-engineer', stat(184_000)], ['data-engineer', stat(184_000)]]), GUIDES)
    expect(tied).toHaveLength(2)
    expect(salaryFaq(tied).map((q) => q.question)).not.toContain('Which tech roles pay the most on Six Figure Jobs?')
  })

  it('leaves it out with fewer than two roles, but still explains the method', () => {
    const one = glanceRows(medians([['software-engineer', stat(180_000)]]), GUIDES)
    const questions = salaryFaq(one).map((q) => q.question)
    expect(questions).not.toContain('Which tech roles pay the most on Six Figure Jobs?')
    expect(questions).toEqual(['How is the median calculated?', 'Are these salaries in US dollars?', 'Where do the listings come from?'])
  })

  it('quotes the real minimum-listings rule, not a hard-coded number', () => {
    const method = salaryFaq([]).find((q) => q.question === 'How is the median calculated?')
    expect(method?.answer).toContain(`at least ${MIN_LISTINGS} listings`)
  })
})

describe('formatMoneyShort', () => {
  it('abbreviates thousands and millions, and shows a dash for no value', () => {
    expect(formatMoneyShort(184_400)).toBe('$184k')
    expect(formatMoneyShort(1_250_000)).toBe('$1.3M')
    expect(formatMoneyShort(null)).toBe('—')
  })
})
