// A posting is identified by (source, externalId) - the database enforces it with a unique index - but the stored `id` is
// not always `<source>:<externalId>`: a job first stored by one source and later upgraded to an ATS keeps its old id. On
// 2026-11-16 the direct-employer sync failed to save 805 postings with "Unique constraint failed on the fields:
// (`externalId`,`source`)", because the ingest looked for a match by dedupe key, URL and canonical id only, found none
// (the title or place had changed, or the id was an old one), tried to create the row, and the identity was taken.
const findFirst = jest.fn()
const findMany = jest.fn()
const findUnique = jest.fn()
const update = jest.fn()
const upsert = jest.fn()
jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
      upsert: (...a: unknown[]) => upsert(...a),
    },
  },
}))
jest.mock('../../lib/jobs/indexingQueue', () => ({ enqueueJobIndexingUpdate: jest.fn() }))
jest.mock('../../lib/jobs/indexingNotifications', () => ({ notifyJobInsertedForIndexing: jest.fn() }))

import { ingestJob } from '../../lib/ingest/index'
import { getSourcePriority } from '../../lib/ingest/sourcePriority'
import type { ScrapedJobInput } from '../../lib/ingest/types'

const ATS = 'ats:greenhouse'
const FREEHIRE = 'board:freehire'

const input = (over: Partial<ScrapedJobInput> = {}): ScrapedJobInput =>
  ({
    externalId: '8451998002',
    title: 'Software Engineer, Telemetry (Starlink)',
    source: ATS,
    rawCompanyName: 'SpaceX',
    url: 'https://boards.greenhouse.io/spacex/jobs/8451998002',
    locationText: 'Hawthorne, CA',
    salaryMin: 150000,
    salaryMax: 200000,
    salaryCurrency: 'USD',
    resolvedCompany: { id: 'c1', name: 'SpaceX' },
    ...over,
  }) as ScrapedJobInput

const stored = (over: Record<string, unknown> = {}) => ({
  id: 'ats:greenhouse:8451998002',
  externalId: '8451998002',
  title: 'Software Engineer, Telemetry (Starlink)',
  company: 'SpaceX',
  companyId: 'c1',
  source: ATS,
  sourcePriority: getSourcePriority(ATS),
  dedupeKey: 'c1::old title::old place',
  url: 'https://boards.greenhouse.io/spacex/jobs/8451998002',
  applyUrl: 'https://boards.greenhouse.io/spacex/jobs/8451998002',
  isExpired: false,
  ...over,
})

/** The database: no row matches by dedupe key or by id, so only the (source, externalId) identity can find the job. */
function database(byIdentity: Record<string, unknown> | null) {
  findFirst.mockResolvedValue(null)
  findMany.mockResolvedValue([])
  findUnique.mockImplementation(async (args: { where: { id?: string; externalId_source?: unknown } }) =>
    args.where.externalId_source ? byIdentity : null,
  )
  upsert.mockRejectedValue(new Error('Unique constraint failed on the fields: (`externalId`,`source`)'))
  update.mockResolvedValue({})
}

beforeEach(() => {
  for (const fn of [findFirst, findMany, findUnique, update, upsert]) fn.mockReset()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('a posting whose stored row has another id, title or place', () => {
  it('is refreshed through its (source, externalId) identity instead of being created again', async () => {
    database(stored({ id: 'board:freehire:legacy-123' }))

    const result = await ingestJob(input())

    expect(upsert).not.toHaveBeenCalled()
    expect(result.status).toBe('updated')
    expect(result.jobId).toBe('board:freehire:legacy-123')
    expect(update.mock.calls[0][0].where).toEqual({ id: 'board:freehire:legacy-123' })
  })

  it('reactivates the stored row when the employer lists the posting again', async () => {
    database(stored({ id: 'greenhouse-legacy-9', isExpired: true }))

    const result = await ingestJob(input())

    expect(result.status).toBe('updated')
    expect(update.mock.calls[0][0].data.isExpired).toBe(false)
  })

  it('still creates the job when nothing holds that identity', async () => {
    database(null)
    upsert.mockResolvedValue({})

    const result = await ingestJob(input())

    expect(result.status).toBe('created')
    expect(upsert).toHaveBeenCalledTimes(1)
  })
})

describe('a lower-priority copy found by dedupe key while the posting already has its own row', () => {
  it('refreshes the posting’s own row and leaves the copy alone, so the identity is not claimed twice', async () => {
    const copy = stored({ id: 'board:freehire:fh-1', externalId: 'fh-1', source: FREEHIRE, sourcePriority: getSourcePriority(FREEHIRE), dedupeKey: 'k' })
    const own = stored({ id: 'ats:greenhouse:8451998002' })
    findFirst.mockResolvedValue(copy)
    findMany.mockResolvedValue([])
    findUnique.mockImplementation(async (args: { where: { externalId_source?: unknown } }) => (args.where.externalId_source ? own : null))
    update.mockResolvedValue({})

    const result = await ingestJob(input())

    expect(result.status).toBe('updated')
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0].where).toEqual({ id: own.id })
    expect(update.mock.calls[0][0].data).not.toHaveProperty('externalId')
  })

  it('still upgrades the copy to the ATS when no row holds the posting’s identity', async () => {
    const copy = stored({ id: 'board:freehire:fh-1', externalId: 'fh-1', source: FREEHIRE, sourcePriority: getSourcePriority(FREEHIRE), dedupeKey: 'k' })
    findFirst.mockResolvedValue(copy)
    findMany.mockResolvedValue([])
    findUnique.mockResolvedValue(null)
    update.mockResolvedValue({})

    const result = await ingestJob(input())

    expect(result.status).toBe('upgraded')
    expect(update.mock.calls[0][0].where).toEqual({ id: copy.id })
    expect(update.mock.calls[0][0].data).toMatchObject({ externalId: '8451998002', source: ATS })
  })
})
