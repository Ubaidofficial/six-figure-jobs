// The pay-ranked list puts remote and hybrid jobs ahead of their pay rank (three of five positions) and loses none.
import { FLEX_WHERE, OTHER_WHERE } from '../../lib/jobs/workModeBlend'

const flexRows = Array.from({ length: 30 }, (_, i) => ({ id: `F${i}`, title: `Flex ${i}`, company: 'Acme', descriptionHtml: null }))
const otherRows = Array.from({ length: 70 }, (_, i) => ({ id: `O${i}`, title: `Onsite ${i}`, company: 'Acme', descriptionHtml: null }))

const count = jest.fn()
const findMany = jest.fn()
jest.mock('../../lib/prisma', () => ({ prisma: { job: { count: (...a: unknown[]) => count(...a), findMany: (...a: unknown[]) => findMany(...a) } } }))

import { queryJobs, shouldBlendWorkModes } from '../../lib/jobs/queryJobs'

const has = (where: any, clause: object) => Array.isArray(where?.AND) && where.AND.includes(clause)

beforeEach(() => {
  count.mockReset()
  findMany.mockReset()
  delete process.env.WORK_MODE_BLEND
  count.mockImplementation(async ({ where }: any) => (has(where, FLEX_WHERE) ? flexRows.length : flexRows.length + otherRows.length))
  findMany.mockImplementation(async ({ where, skip = 0, take }: any) => {
    if (has(where, FLEX_WHERE)) return flexRows.slice(skip, skip + take)
    if (has(where, OTHER_WHERE)) return otherRows.slice(skip, skip + take)
    return [] // card summaries (descriptions by id)
  })
})

const ids = (r: { jobs: Array<{ id: string }> }) => r.jobs.map((j) => j.id)

describe('queryJobs, pay-ranked, remote and hybrid blended in', () => {
  it('page 1: three of five positions are remote or hybrid, each stream in its own pay order', async () => {
    const r = await queryJobs({ page: 1, pageSize: 10 })
    expect(ids(r)).toEqual(['F0', 'F1', 'O0', 'F2', 'O1', 'F3', 'F4', 'O2', 'F5', 'O3'])
    expect(r.total).toBe(100)
    expect(r.totalPages).toBe(10)
  })

  it('walks every page with no job lost or repeated, and the total is unchanged', async () => {
    const seen: string[] = []
    for (let page = 1; page <= 10; page++) seen.push(...ids(await queryJobs({ page, pageSize: 10 })))
    expect(seen.length).toBe(100)
    expect(new Set(seen).size).toBe(100)
    expect(seen.filter((s) => s.startsWith('O')).length).toBe(70) // on-site jobs are all still listed
  })

  it('does not blend a list already narrowed by work mode or company, a one-row count, or when switched off', async () => {
    expect(shouldBlendWorkModes({ page: 1 }, 10)).toBe(true)
    expect(shouldBlendWorkModes({ remoteOnly: true }, 10)).toBe(false)
    expect(shouldBlendWorkModes({ remoteMode: 'hybrid' }, 10)).toBe(false)
    expect(shouldBlendWorkModes({ companySlug: 'acme' }, 10)).toBe(false)
    expect(shouldBlendWorkModes({ page: 1 }, 1)).toBe(false)
    process.env.WORK_MODE_BLEND = 'off'
    expect(shouldBlendWorkModes({ page: 1 }, 10)).toBe(false)
  })

  it('reads the plain pay-ranked list when it is not blended', async () => {
    process.env.WORK_MODE_BLEND = 'off'
    findMany.mockResolvedValue([])
    count.mockResolvedValue(0)
    await queryJobs({ page: 1, pageSize: 10 })
    expect(findMany.mock.calls[0][0].orderBy[0]).toEqual({ maxAnnual: 'desc' })
    expect(has(findMany.mock.calls[0][0].where, FLEX_WHERE)).toBe(false)
  })
})
