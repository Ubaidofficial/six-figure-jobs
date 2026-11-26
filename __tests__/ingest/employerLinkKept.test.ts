const findFirst = jest.fn()
const update = jest.fn()
jest.mock('../../lib/prisma', () => ({
  prisma: { job: { findFirst: (...a: unknown[]) => findFirst(...a), findMany: async () => [], findUnique: async () => null, update: (...a: unknown[]) => update(...a) } },
}))
jest.mock('../../lib/jobs/indexingQueue', () => ({ enqueueJobIndexingUpdate: jest.fn() }))

import { ingestJob } from '../../lib/ingest/index'
import { getSourcePriority } from '../../lib/ingest/sourcePriority'
import type { ScrapedJobInput } from '../../lib/ingest/types'

// A freehire job whose LinkedIn link was replaced by the employer's Workday link (lib/scrapers/freehireDirectLink.ts).
const SOURCE = 'board:freehire'
const DIRECT = 'https://acme.wd5.myworkdayjobs.com/External/job/Remote/Engineer_R1'
const BOARD = 'https://www.linkedin.com/jobs/view/4300000001'

const input = (over: Partial<ScrapedJobInput>): ScrapedJobInput =>
  ({ externalId: '1', title: 'Engineer', source: SOURCE, rawCompanyName: 'Acme', resolvedCompany: { id: 'c1', name: 'Acme' }, ...over }) as ScrapedJobInput
const stored = (over: Record<string, unknown> = {}) => ({
  id: 'board:freehire:1',
  title: 'Engineer',
  company: 'Acme',
  companyId: 'c1',
  source: SOURCE,
  sourcePriority: getSourcePriority(SOURCE),
  dedupeKey: 'k',
  url: DIRECT,
  applyUrl: DIRECT,
  countryCode: 'US',
  postedAt: new Date('2026-11-25T00:00:00Z'),
  ...over,
})

async function refresh(existing: Record<string, unknown>, over: Partial<ScrapedJobInput>) {
  findFirst.mockResolvedValueOnce(existing)
  update.mockClear()
  const result = await ingestJob(input(over))
  expect(result.status).toBe('updated')
  return update.mock.calls[0][0].data
}

describe('an employer link found for a job-board job is kept', () => {
  it('a later run that only has the board link does not put it back', async () => {
    const data = await refresh(stored(), { url: BOARD, applyUrl: BOARD })
    expect(data.applyUrl ?? DIRECT).toBe(DIRECT)
  })

  it('a board link is still replaced by an employer link', async () => {
    const data = await refresh(stored({ url: BOARD, applyUrl: BOARD }), { url: DIRECT, applyUrl: DIRECT })
    expect(data.applyUrl).toBe(DIRECT)
  })
})
