import { buildWhere } from '../../lib/jobs/queryJobs'

describe('buildWhere keyword search', () => {
  it('matches keyword search across title, company, location, and skill fields', () => {
    const where = buildWhere({ keyword: 'react' })
    const andClauses = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []

    expect(andClauses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            { title: { contains: 'react', mode: 'insensitive' } },
            { company: { contains: 'react', mode: 'insensitive' } },
            { locationRaw: { contains: 'react', mode: 'insensitive' } },
            { techStack: { contains: 'react', mode: 'insensitive' } },
            { skillsJson: { contains: 'react', mode: 'insensitive' } },
          ]),
        }),
      ]),
    )
  })

  const keywordClauses = (where: any) => {
    const and = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []
    return and.filter(
      (c: any) => Array.isArray(c.OR) && c.OR.some((o: any) => o?.title?.contains),
    )
  }

  it('tokenizes multi-word queries into AND-ed per-word matches (order-independent)', () => {
    const where = buildWhere({ keyword: 'senior backend python' })
    const clauses = keywordClauses(where)
    expect(clauses).toHaveLength(3)
    const titleTerms = clauses.map((c: any) => c.OR.find((o: any) => o.title).title.contains)
    expect(titleTerms.sort()).toEqual(['backend', 'python', 'senior'])
  })

  it('drops stopwords so they do not over-filter the query', () => {
    const where = buildWhere({ keyword: 'remote python jobs' })
    const clauses = keywordClauses(where)
    // "remote" + "jobs" are stopwords → only "python" remains
    expect(clauses).toHaveLength(1)
    expect(clauses[0].OR).toEqual(
      expect.arrayContaining([{ title: { contains: 'python', mode: 'insensitive' } }]),
    )
  })
})
