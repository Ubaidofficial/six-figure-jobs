import { AUDITS, summarizeFlags, toMarkdown } from '@/scripts/audit-db-coverage'

describe('database coverage audit', () => {
  it('is read-only: every query is one SELECT and none can write', () => {
    expect(AUDITS.length).toBeGreaterThan(5)
    for (const { title, sql } of AUDITS) {
      expect({ title, startsWithSelect: /^\s*SELECT\b/i.test(sql) }).toEqual({ title, startsWithSelect: true })
      expect({ title, oneStatement: !sql.includes(';') }).toEqual({ title, oneStatement: true })
      expect({ title, writes: /\b(insert|update|delete|drop|alter|truncate|create|grant|copy)\b/i.test(sql) }).toEqual({
        title,
        writes: false,
      })
    }
  })

  it('has a title for every query, and no two share one', () => {
    const titles = AUDITS.map((a) => a.title)
    expect(titles.every(Boolean)).toBe(true)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('turns rows into a Markdown table, keeping bigint counts, dates and pipes in text readable', () => {
    const md = toMarkdown({ title: 'Sample', note: 'A note.' }, [
      { text: 'Remote | EMEA', jobs: BigInt(12), seen: new Date('2026-11-13T08:10:00Z'), empty: null },
    ])
    expect(md).toContain('### Sample')
    expect(md).toContain('_A note._')
    expect(md).toContain('| text | jobs | seen | empty |')
    expect(md).toContain('| Remote \\| EMEA | 12 | 2026-11-13T08:10:00.000Z |  |')
    expect(toMarkdown({ title: 'Empty' }, [])).toContain('(no rows)')
  })

  it('classifies flags against the location text', () => {
    const { counts } = summarizeFlags([
      { primaryLocation: 'Dublin, Ireland', locationRaw: null, countryCode: 'GB' },
      { primaryLocation: 'Berlin, Germany', locationRaw: null, countryCode: null },
      { primaryLocation: 'Berlin', locationRaw: null, countryCode: 'DE' },
      { primaryLocation: 'Somewhere', locationRaw: null, countryCode: null },
    ])
    expect(counts).toEqual({ checked: 4, stored_ok: 1, text_disagrees: 1, stored_missing_text_has: 1, none_findable: 1 })
  })
})
