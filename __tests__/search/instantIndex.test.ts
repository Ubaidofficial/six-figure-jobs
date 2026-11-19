jest.mock('../../lib/prisma', () => ({ prisma: {} }))

import { buildWhere } from '../../lib/jobs/queryJobs'
import { buildKeywordPlan } from '../../lib/search/keywordPlan'
import { matchesPlan, passesFilters, searchInstantIndex, withSearchFields, type IndexedJob } from '../../lib/search/instantIndex'

const job = (id: string, title: string, over: Partial<IndexedJob> = {}): IndexedJob =>
  withSearchFields({
    id, title, company: 'Acme', locationRaw: 'Remote', techStack: '', skillsJson: '[]', posted: 1_000, remoteMode: 'remote',
    minAnnual: 150_000, maxAnnual: 200_000, currency: 'USD', pay: '$150k - $200k', href: `/job/${id}`, logo: null, ...over,
  })

// buildWhere's keyword clauses, interpreted for one row (the operators they use: OR, startsWith, contains; insensitive).
function dbMatches(keyword: string, row: IndexedJob): boolean {
  const where: any = buildWhere({ keyword, keywordPlan: buildKeywordPlan(keyword, null) })
  const clauses = (Array.isArray(where.AND) ? where.AND : []).filter(
    (c: any) => Array.isArray(c.OR) && c.OR.some((o: any) => o?.title?.startsWith || o?.title?.contains),
  )
  const one = (c: any): boolean => {
    if (Array.isArray(c.OR)) return c.OR.some(one)
    const [field, op] = Object.entries(c)[0] as [string, any]
    const v = String((row as any)[field] ?? '').toLowerCase()
    return typeof op.startsWith === 'string' ? v.startsWith(op.startsWith.toLowerCase()) : v.includes(op.contains.toLowerCase())
  }
  return clauses.every(one)
}

describe('instant index matching', () => {
  const rows = [
    job('a', 'Senior Frontend Engineer'),
    job('b', 'Front-End Developer (React)'),
    job('c', 'Warehouse Operations Lead'),
    job('d', 'SEO Manager', { company: 'Searchly' }),
    job('e', 'Product Manager', { techStack: 'figma, sql' }),
    job('f', 'Staff Engineer', { skillsJson: '["kotlin","go"]', locationRaw: 'Berlin, Germany' }),
  ]
  const queries = ['frontend', 'front-end engineer', 'seo', 'pm', 'engin', 'kotlin', 'berlin', 'sql manager', 'react dev', 'ops']

  it('matches exactly the jobs the database keyword filter matches', () => {
    for (const q of queries) {
      const plan = buildKeywordPlan(q, null)
      for (const r of rows) expect([q, r.id, matchesPlan(plan, r)]).toEqual([q, r.id, dbMatches(q, r)])
    }
  })

  it('applies the work arrangement and a US-dollar minimum as the listing does', () => {
    expect(passesFilters(job('x', 't'), { remoteMode: 'remote', minAnnual: 180_000 })).toBe(true)
    expect(passesFilters(job('x', 't', { remoteMode: 'hybrid' }), { remoteMode: 'remote' })).toBe(false)
    expect(passesFilters(job('x', 't', { currency: 'GBP', maxAnnual: 300_000 }), { minAnnual: 180_000 })).toBe(false)
    expect(passesFilters(job('x', 't', { maxAnnual: 170_000 }), { minAnnual: 180_000 })).toBe(false)
    expect(passesFilters(job('x', 't', { currency: 'GBP' }), {})).toBe(true)
  })
})

describe('searchInstantIndex', () => {
  const opts = { now: 10_000, shown: 3, maxTitles: 4, maxTitleWords: 4 }

  it('counts every match, ranks title matches first and then newer, and groups matching titles', () => {
    const jobs = [
      job('1', 'React Engineer', { posted: 100 }),
      job('2', 'React Engineer', { posted: 200 }),
      job('3', 'react  engineer', { posted: 300 }),
      job('4', 'Platform Engineer', { skillsJson: '["react"]', posted: 900 }),
      job('5', 'Data Analyst'),
    ]
    const r = searchInstantIndex(jobs, buildKeywordPlan('react eng', null), 'react eng', {}, opts)
    expect(r.total).toBe(4)
    expect(r.jobs.map((j) => j.id)).toEqual(['3', '2', '1'])
    expect(r.titles).toEqual([{ label: 'React Engineer', count: 3 }])
  })

  it('returns nothing for a query with no searchable words', () => {
    expect(searchInstantIndex([job('1', 'Engineer')], buildKeywordPlan('the', null), 'the', {}, opts)).toMatchObject({ total: 0, jobs: [] })
  })
})
