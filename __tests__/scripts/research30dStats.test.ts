import { RESEARCH, buildResearch, windowFor, type Basis } from '@/scripts/research-30d-stats'

const BASES: Basis[] = ['created', 'posted', 'posted_or_created']

describe('30-day research report', () => {
  it('is read-only under every window definition: every query is one SELECT and none can write', () => {
    for (const basis of BASES) {
      const queries = buildResearch(basis)
      expect(queries.length).toBeGreaterThan(12)
      for (const { title, sql } of queries) {
        expect({ basis, title, startsWithSelect: /^\s*SELECT\b/i.test(sql) }).toEqual({ basis, title, startsWithSelect: true })
        expect({ basis, title, oneStatement: !sql.includes(';') }).toEqual({ basis, title, oneStatement: true })
        expect({ basis, title, writes: /\b(insert|update|delete|drop|alter|truncate|create|grant|copy)\b/i.test(sql) }).toEqual({
          basis,
          title,
          writes: false,
        })
      }
    }
  })

  it('has a title for every query, and no two share one', () => {
    const titles = RESEARCH.map((a) => a.title)
    expect(titles.every(Boolean)).toBe(true)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('applies the same pay gate to every pay figure: validated, confident, USD, below the cap', () => {
    for (const basis of BASES) {
      const payQueries = buildResearch(basis).filter((a) => a.pay)
      expect(payQueries.length).toBeGreaterThan(10)
      for (const { title, sql } of payQueries) {
        expect({ title, gated: sql.includes(`"salaryValidated"`) && sql.includes(`"salaryConfidence" >= 80`) }).toEqual({ title, gated: true })
        expect({ title, usd: sql.includes(`"currency" = 'USD'`) }).toEqual({ title, usd: true })
        expect({ title, belowCap: sql.includes('< 600000') && !sql.includes('<= 600000') }).toEqual({ title, belowCap: true })
      }
    }
  })

  it('uses the chosen window only in the pay tables, and the three definitions differ', () => {
    expect(new Set(BASES.map(windowFor)).size).toBe(3)
    expect(windowFor('created')).toContain('"createdAt"')
    expect(windowFor('posted')).toContain('"postedAt"')
    expect(windowFor('posted_or_created')).toContain('COALESCE')
    const posted = buildResearch('posted').filter((a) => a.pay && /^Pay by role$/.test(a.title))[0]
    expect(posted.sql).toContain(windowFor('posted'))
  })

  it('leaves job boards out of employer rankings and guards groups by employer count', () => {
    const employers = RESEARCH.find((a) => /Employers with the most/.test(a.title))!
    expect(employers.sql).toMatch(/NOT ILIKE ALL/i)
    expect(employers.sql).toContain('jobgether')
    const byRole = RESEARCH.find((a) => a.title === 'Pay by role')!
    expect(byRole.sql).toContain('count(DISTINCT company) >= 5')
  })

  it('no longer reports the fields that were empty or unreliable', () => {
    const all = RESEARCH.map((a) => `${a.title} ${a.sql}`).join('\n')
    for (const gone of ['stateCode', 'industry', 'noDegreeMention', 'change_pct']) expect(all).not.toContain(gone)
  })
})
