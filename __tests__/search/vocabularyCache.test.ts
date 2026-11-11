const findMany = jest.fn()
jest.mock('../../lib/prisma', () => ({ prisma: { job: { findMany: (...a: unknown[]) => findMany(...a) } } }))

import { __clearMemoForTests } from '../../lib/cache/memo'
import { getSearchVocabulary } from '../../lib/search/vocabulary'

const rows = [{ title: 'Senior Data Engineer', company: 'Acme', locationRaw: 'Remote', techStack: null, skillsJson: '["Python"]' }]

describe('search vocabulary cache', () => {
  beforeEach(() => {
    __clearMemoForTests()
    findMany.mockReset()
  })

  it('reads the database once for concurrent callers', async () => {
    let release!: () => void
    findMany.mockImplementation(() => new Promise((r) => (release = () => r(rows))))
    const calls = [getSearchVocabulary(0), getSearchVocabulary(0), getSearchVocabulary(0)]
    release()
    const [a, b, c] = await Promise.all(calls)
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(a.terms.length).toBeGreaterThan(0)
  })

  it('after 30 minutes serves the old vocabulary at once and refreshes it in the background', async () => {
    findMany.mockResolvedValueOnce(rows)
    const first = await getSearchVocabulary(0)
    let release!: () => void
    findMany.mockImplementationOnce(() => new Promise((r) => (release = () => r(rows))))
    const later = await getSearchVocabulary(31 * 60 * 1000) // returns without waiting for the reload
    expect(later).toBe(first)
    expect(findMany).toHaveBeenCalledTimes(2)
    release()
  })
})
