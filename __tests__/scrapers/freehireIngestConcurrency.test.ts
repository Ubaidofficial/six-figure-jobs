const ingestBoardJob = jest.fn()
jest.mock('../../lib/jobs/ingestBoardJob', () => ({ ingestBoardJob: (...a: unknown[]) => ingestBoardJob(...a) }))

import type { BoardJobInput } from '../../lib/jobs/ingestBoardJob'
import { ingestFreehireJobs } from '../../lib/scrapers/freehire'

const job = (externalId: string, company: string | null): BoardJobInput => ({ externalId, title: 't', url: `https://x.example/${externalId}`, rawCompanyName: company })
const tick = () => new Promise((r) => setTimeout(r, 1))

describe('ingestFreehireJobs', () => {
  beforeEach(() => ingestBoardJob.mockReset())

  it('writes several companies at once but one company\'s jobs strictly in order, and counts every result', async () => {
    let running = 0
    let peak = 0
    const busy = new Set<string>()
    const order: string[] = []
    ingestBoardJob.mockImplementation(async (_board: string, input: BoardJobInput) => {
      const key = String(input.rawCompanyName).toLowerCase().replace(/[^a-z0-9]+/g, '')
      expect(busy.has(key)).toBe(false) // never two jobs of one company at the same time
      busy.add(key)
      peak = Math.max(peak, ++running)
      await tick()
      order.push(input.externalId)
      running--
      busy.delete(key)
      return input.externalId.endsWith('n') ? 'new' : input.externalId.endsWith('u') ? 'updated' : 'skipped'
    })
    const inputs = [job('a1n', 'Acme'), job('b1u', 'Beta'), job('a2u', 'ACME'), job('c1s', 'Gamma'), job('d1n', 'Delta'), job('e1s', 'Epsilon'), job('a3s', 'acme')]
    const stats = await ingestFreehireJobs(inputs)
    expect(stats).toMatchObject({ created: 2, updated: 2, skipped: 3 })
    expect(ingestBoardJob).toHaveBeenCalledTimes(7)
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(4)
    expect(order.filter((id) => id.startsWith('a'))).toEqual(['a1n', 'a2u', 'a3s'])
  })

  it('treats jobs without a company name as separate groups and handles an empty list', async () => {
    ingestBoardJob.mockResolvedValue('skipped')
    expect(await ingestFreehireJobs([job('x', null), job('y', '')])).toMatchObject({ skipped: 2 })
    expect(await ingestFreehireJobs([])).toMatchObject({ created: 0, updated: 0, skipped: 0 })
  })
})
