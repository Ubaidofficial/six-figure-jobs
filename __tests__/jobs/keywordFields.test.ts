jest.mock('../../lib/prisma', () => ({ prisma: {} }))
jest.mock('../../lib/search/vocabulary', () => ({ getSearchVocabulary: jest.fn() }))

import { buildWhere } from '../../lib/jobs/queryJobs'

// The fields of the where's insensitive matches whose pattern contains `word` (the keyword's own clauses).
function fieldsMatching(where: unknown, word: string): string[] {
  const fields = new Set<string>()
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object' && 'mode' in value && JSON.stringify(value).toLowerCase().includes(word)) fields.add(key)
      walk(value)
    }
  }
  walk(where)
  return [...fields].sort()
}

describe('buildWhere keywordFields', () => {
  it('matches a keyword in every searchable field by default', () => {
    expect(fieldsMatching(buildWhere({ keyword: 'account director' }), 'director')).toEqual(
      ['company', 'locationRaw', 'skillsJson', 'techStack', 'title'],
    )
  })

  it('matches only the given fields when keywordFields is set (the job page: title only)', () => {
    expect(fieldsMatching(buildWhere({ keyword: 'account director', keywordFields: ['title'] }), 'director')).toEqual(['title'])
  })
})
