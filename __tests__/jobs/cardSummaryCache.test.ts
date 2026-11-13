const findMany = jest.fn()
jest.mock('../../lib/prisma', () => ({ prisma: { job: { findMany: (...args: unknown[]) => findMany(...args) } } }))

import { withCardSummaries } from '../../lib/jobs/queryJobs'

const description = (n: number) =>
  `<p>Example Co is hiring an engineer to build payment systems ${n}.</p><ul><li>5+ years of experience</li><li>Equity and 401(k)</li></ul>`

function answerFor(ids: string[]) {
  return ids.map((id) => ({ id, descriptionHtml: id.endsWith('-none') ? null : description(Number(id.replace(/\D/g, '')) || 0) }))
}

beforeEach(() => {
  findMany.mockReset()
  findMany.mockImplementation(async (q: { where: { id: { in: string[] } } }) => answerFor(q.where.id.in))
})

// Listing pages downloaded the full description of every job they showed on every view (about 1 GB an hour from the
// database on 2026-11-13). Card details are now kept per job, so a job's description is read once, not on every view.
describe('withCardSummaries keeps each job\'s card details', () => {
  it('reads descriptions once, then only for jobs it has not seen', async () => {
    const page = [{ id: 'cache-a1', company: 'Example Co' }, { id: 'cache-a2', company: 'Example Co' }]
    const first = await withCardSummaries(page)
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(first[0].cardBenefits).toEqual(expect.arrayContaining(['Equity', '401(k)']))
    expect(first[0].cardExperience).toBe('5+ years')

    const again = await withCardSummaries(page)
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(again).toEqual(first)

    await withCardSummaries([...page, { id: 'cache-a3', company: 'Example Co' }])
    expect(findMany).toHaveBeenCalledTimes(2)
    expect(findMany.mock.calls[1][0].where.id.in).toEqual(['cache-a3'])
  })

  it('remembers a job with no description instead of asking again', async () => {
    await withCardSummaries([{ id: 'cache-b-none' }])
    await withCardSummaries([{ id: 'cache-b-none' }])
    expect(findMany).toHaveBeenCalledTimes(1)
  })

  it('leaves the jobs as they were when the database fails', async () => {
    findMany.mockRejectedValueOnce(new Error('P2024 pool timeout'))
    const jobs = [{ id: 'cache-c1', company: 'Example Co' }]
    expect(await withCardSummaries(jobs)).toEqual(jobs)
  })
})
