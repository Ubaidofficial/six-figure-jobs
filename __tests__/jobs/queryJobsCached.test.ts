const findMany = jest.fn()
const count = jest.fn()
jest.mock('../../lib/prisma', () => ({
  prisma: { job: { findMany: (...a: unknown[]) => findMany(...a), count: (...a: unknown[]) => count(...a) } },
}))

import { __clearMemoForTests } from '../../lib/cache/memo'
import { queryJobsCached } from '../../lib/jobs/queryJobs'

// Pages that read `searchParams` are rendered on every request, so without this each visit ran its list and count queries again.
beforeEach(() => {
  __clearMemoForTests()
  findMany.mockReset().mockResolvedValue([])
  count.mockReset().mockResolvedValue(0)
})

const queries = () => findMany.mock.calls.length + count.mock.calls.length

describe('queryJobsCached', () => {
  it('runs the database queries once and serves a repeat request from memory', async () => {
    const input = { roleSlugs: ['software-engineer'], page: 1, pageSize: 40 }
    const first = await queryJobsCached('salary-role-list', input)
    const afterFirst = queries()
    expect(afterFirst).toBeGreaterThan(0)
    const second = await queryJobsCached('salary-role-list', { ...input })
    expect(queries()).toBe(afterFirst) // no new queries
    expect(second).toBe(first)
  })

  it('keeps pages, roles and page numbers apart', async () => {
    await queryJobsCached('salary-role-list', { roleSlugs: ['software-engineer'], page: 1, pageSize: 40 })
    const one = queries()
    await queryJobsCached('salary-role-list', { roleSlugs: ['data-engineer'], page: 1, pageSize: 40 }) // another role
    const two = queries()
    await queryJobsCached('salary-role-list', { roleSlugs: ['software-engineer'], page: 2, pageSize: 40 }) // another page
    const three = queries()
    await queryJobsCached('remote-role-list', { roleSlugs: ['software-engineer'], page: 1, pageSize: 40 }) // another page type
    const four = queries()
    expect(two).toBeGreaterThan(one)
    expect(three).toBeGreaterThan(two)
    expect(four).toBeGreaterThan(three)
  })
})
