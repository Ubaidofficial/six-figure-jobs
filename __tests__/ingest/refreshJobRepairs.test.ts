const findFirst = jest.fn()
const update = jest.fn()
jest.mock('../../lib/prisma', () => ({
  prisma: { job: { findFirst: (...a: unknown[]) => findFirst(...a), findMany: async () => [], findUnique: async () => null, update: (...a: unknown[]) => update(...a) } },
}))
jest.mock('../../lib/jobs/indexingQueue', () => ({ enqueueJobIndexingUpdate: jest.fn() }))

import { ingestJob } from '../../lib/ingest/index'
import { getSourcePriority } from '../../lib/ingest/sourcePriority'
import type { ScrapedJobInput } from '../../lib/ingest/types'

const SOURCE = 'ats:greenhouse'
const input = (over: Partial<ScrapedJobInput>): ScrapedJobInput =>
  ({
    externalId: '1',
    title: 'Engineer',
    source: SOURCE,
    rawCompanyName: 'Acme',
    url: 'https://boards.greenhouse.io/acme/jobs/1',
    resolvedCompany: { id: 'c1', name: 'Acme' },
    ...over,
  }) as ScrapedJobInput

// A job stored before 2026-11-09: no posting date, and "San Francisco, CA" read as Canada.
const stored = (over: Record<string, unknown> = {}) => ({
  id: 'ats:greenhouse:1',
  title: 'Engineer',
  company: 'Acme',
  companyId: 'c1',
  source: SOURCE,
  sourcePriority: getSourcePriority(SOURCE),
  dedupeKey: 'k',
  url: 'https://boards.greenhouse.io/acme/jobs/1',
  applyUrl: 'https://boards.greenhouse.io/acme/jobs/1',
  countryCode: 'CA',
  postedAt: null,
  ...over,
})

async function refresh(existing: Record<string, unknown>, over: Partial<ScrapedJobInput>) {
  findFirst.mockResolvedValueOnce(existing)
  update.mockClear()
  const result = await ingestJob(input(over))
  expect(result.status).toBe('updated')
  return update.mock.calls[0][0].data
}

describe('refreshing a stored job', () => {
  it('fills a missing posting date and corrects a country read wrongly', async () => {
    const postedAt = new Date('2026-06-26T21:37:46Z')
    const data = await refresh(stored(), { locationText: 'San Francisco, CA', salaryCurrency: 'USD', postedAt })
    expect(data.postedAt).toEqual(postedAt)
    expect(data.countryCode).toBe('US')
  })

  it('never moves a stored posting date, and never clears a stored country', async () => {
    const data = await refresh(stored({ postedAt: new Date('2026-01-01T00:00:00Z'), countryCode: 'GB' }), {
      locationText: 'Remote',
      isRemote: true,
      postedAt: new Date('2026-11-09T00:00:00Z'),
    })
    expect(data).not.toHaveProperty('postedAt')
    expect(data).not.toHaveProperty('countryCode')
  })
})
