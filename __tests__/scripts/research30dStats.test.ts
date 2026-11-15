import { RESEARCH, buildResearch, windowFor, type Basis } from '@/scripts/research-30d-stats'
import { AGGREGATOR_PATTERNS, BAY_AREA_CITIES, MIN_CONFIDENCE, MIN_SAME_ROLE_EMPLOYERS, MIN_SKILL_EMPLOYERS, USD_CAP } from '@/lib/research/method'

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

  it('has the three queries behind the report\'s extra findings, with the same sample floors the page states', () => {
    const wide = RESEARCH.find((a) => a.title === 'Pay: how wide the advertised ranges are')!
    expect(wide.pay).toBe(true)
    expect(wide.sql).toContain('"maxAnnual" > "minAnnual"')
    const sameRole = RESEARCH.find((a) => a.title === 'Pay: the same role, remote against on-site')!
    expect(sameRole.sql).toContain('count(*) >= 20 AND count(DISTINCT company) >= 5')
    expect(sameRole.sql).toContain(`= 'remote'`)
    expect(sameRole.sql).toContain(`= 'onsite'`)
    const skills = RESEARCH.find((a) => a.title === 'Pay by skill named in the listing')!
    expect(skills.sql).toContain('count(*) >= 50 AND count(DISTINCT j.company) >= 10')
    // A skill is a quoted JSON token, so "Java" cannot match "JavaScript".
    expect(skills.sql).toContain(`ILIKE '%"' || s.skill || '"%'`)
    expect(skills.sql).toContain(`('Java')`)
  })

  it('builds its rules from the shared method file, so the methodology page and the query cannot disagree', () => {
    const all = buildResearch('created').map((a) => a.sql).join('\n')
    for (const pattern of AGGREGATOR_PATTERNS) expect(all).toContain(`'${pattern}'`)
    expect(all).toContain(`"salaryConfidence" >= ${MIN_CONFIDENCE}`)
    expect(all).toContain(`< ${USD_CAP}`)
    for (const city of BAY_AREA_CITIES) expect(all).toContain(`'${city}'`)
    const sameRole = RESEARCH.find((a) => a.title === 'Pay: the same role, remote against on-site')!
    expect(sameRole.sql).toContain(`count(DISTINCT company) >= ${MIN_SAME_ROLE_EMPLOYERS}`)
    const skills = RESEARCH.find((a) => a.title === 'Pay by skill named in the listing')!
    expect(skills.sql).toContain(`count(DISTINCT j.company) >= ${MIN_SKILL_EMPLOYERS}`)
  })

  it('has the evidence queries: funnel, robustness check (five variants), hand-check sample, quoted highest ranges, middle half', () => {
    const funnel = RESEARCH.find((a) => a.title === 'Evidence: what was counted and what was left out')!
    expect(funnel.pay).toBeFalsy() // it counts jobs that fail the gate on purpose
    expect(funnel.sql).toContain('in_the_report')
    const robust = RESEARCH.find((a) => a.title.startsWith('Pay: do a few big employers'))!
    expect(robust.pay).toBe(true)
    expect(robust.sql.match(/UNION ALL/g)).toHaveLength(4)
    expect(robust.sql).toContain('DISTINCT ON (company, title)')
    const audit = RESEARCH.find((a) => a.title.startsWith('Audit sample'))!
    expect(audit.sql).toContain('ORDER BY random() LIMIT 100')
    const highest = RESEARCH.find((a) => a.title === 'Highest advertised salaries')!
    expect(highest.sql).toContain('"salaryRaw"')
    const byRole = RESEARCH.find((a) => a.title === 'Pay by role')!
    expect(byRole.sql).toContain('p25_usd')
  })
})
