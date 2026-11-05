jest.mock('../../lib/prisma', () => ({ prisma: {} }))
jest.mock('../../lib/search/vocabulary', () => ({ getSearchVocabulary: jest.fn() }))

import { buildWhere } from '../../lib/jobs/queryJobs'

function skillClauses(where: any): Array<{ skillsJson: { contains: string; mode: string } }> {
  const and = Array.isArray(where.AND) ? where.AND : [where.AND]
  return and.flatMap((c: any) => c?.OR ?? []).filter((c: any) => c?.skillsJson?.contains)
}

describe('skill filter', () => {
  it('matches the quoted token so `java` cannot match "javascript" and `sql` cannot match "postgresql"', () => {
    const java = skillClauses(buildWhere({ skillSlugs: ['java'], page: 1, pageSize: 1 }))
    expect(java.map((c) => c.skillsJson.contains)).toEqual(['"java"'])
    const sql = skillClauses(buildWhere({ skillSlugs: ['sql'], page: 1, pageSize: 1 }))
    expect(sql.map((c) => c.skillsJson.contains)).toEqual(['"sql"'])
    // '"java"' is not a substring of '["javascript","postgresql"]'
    expect('["javascript","postgresql"]'.includes(java[0].skillsJson.contains)).toBe(false)
    expect('["java","sql"]'.includes(java[0].skillsJson.contains)).toBe(true)
  })

  it('also matches the spellings freehire stores for node-js, golang and c-plus-plus', () => {
    const tokens = (slug: string) =>
      skillClauses(buildWhere({ skillSlugs: [slug], page: 1, pageSize: 1 })).map((c) => c.skillsJson.contains)
    expect(tokens('node-js')).toContain('"nodejs"')
    expect(tokens('golang')).toContain('"go"')
    expect(tokens('c-plus-plus')).toContain('"cpp"')
  })

  it('is case-insensitive', () => {
    const [clause] = skillClauses(buildWhere({ skillSlugs: ['python'], page: 1, pageSize: 1 }))
    expect(clause.skillsJson.mode).toBe('insensitive')
  })
})
