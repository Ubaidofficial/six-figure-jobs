import { RESEARCH } from '@/scripts/research-30d-stats'

describe('30-day research report', () => {
  it('is read-only: every query is one SELECT and none can write', () => {
    expect(RESEARCH.length).toBeGreaterThan(8)
    for (const { title, sql } of RESEARCH) {
      expect({ title, startsWithSelect: /^\s*SELECT\b/i.test(sql) }).toEqual({ title, startsWithSelect: true })
      expect({ title, oneStatement: !sql.includes(';') }).toEqual({ title, oneStatement: true })
      expect({ title, writes: /\b(insert|update|delete|drop|alter|truncate|create|grant|copy)\b/i.test(sql) }).toEqual({
        title,
        writes: false,
      })
    }
  })

  it('has a title for every query, and no two share one', () => {
    const titles = RESEARCH.map((a) => a.title)
    expect(titles.every(Boolean)).toBe(true)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('applies the same pay gate to every pay figure: validated, confident, USD, capped', () => {
    const payQueries = RESEARCH.filter((a) => /Pay by|salary bands|six-figure|Highest advertised|faster/i.test(a.title))
    expect(payQueries.length).toBeGreaterThan(8)
    for (const { title, sql } of payQueries) {
      expect({ title, gated: sql.includes(`"salaryValidated"`) && sql.includes(`"salaryConfidence" >= 80`) }).toEqual({ title, gated: true })
      expect({ title, usd: sql.includes(`"currency" = 'USD'`) }).toEqual({ title, usd: true })
      expect({ title, capped: sql.includes('<= 600000') }).toEqual({ title, capped: true })
    }
  })
})
