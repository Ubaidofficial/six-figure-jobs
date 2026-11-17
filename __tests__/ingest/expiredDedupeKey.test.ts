// An expired job still holds its (companyId, dedupeKey): the database allows one row per company, title and place. The
// per-company cache the ATS sync builds (lib/jobs/ingestFromAts.ts) left expired rows out of its dedupe-key index, so when an
// employer listed the same title and place again (a new requisition, or a role reopened) the ingest found no match, tried to
// create a second row and failed with "Unique constraint failed on the fields: (`companyId`,`dedupeKey`)". After PR #171
// removed the (externalId, source) failures, the 2026-11-17 full sync still logged 675 of these (rocket-lab 83, brex 42, ...).
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

import { makeJobDedupeKey } from '../../lib/ingest/dedupeHelpers'
import { getSourcePriority } from '../../lib/ingest/sourcePriority'
import { upsertJobsForCompanyFromAts } from '../../lib/jobs/ingestFromAts'

const company = { id: 'c1', name: 'SpaceX', slug: 'spacex', atsProvider: 'greenhouse' }
const TITLE = 'Senior Account Executive'
const PLACE = 'Hawthorne, CA'

const stored = (over: Record<string, unknown> = {}) => ({
  id: 'ats:greenhouse:old-1',
  externalId: 'old-1',
  title: TITLE,
  company: 'SpaceX',
  companyId: 'c1',
  source: 'ats:greenhouse',
  sourcePriority: getSourcePriority('ats:greenhouse'),
  dedupeKey: makeJobDedupeKey('c1', TITLE, PLACE),
  url: 'https://boards.greenhouse.io/spacex/jobs/old-1',
  applyUrl: 'https://boards.greenhouse.io/spacex/jobs/old-1',
  isExpired: true,
  ...over,
})

const raw = {
  externalId: 'new-2',
  title: TITLE,
  locationText: PLACE,
  url: 'https://boards.greenhouse.io/spacex/jobs/new-2',
  salaryMin: 150000,
  salaryMax: 200000,
  salaryCurrency: 'USD',
  descriptionHtml: '<p>Sell things.</p>',
}

beforeEach(() => {
  for (const fn of [findFirst, findMany, findUnique, update, upsert]) fn.mockReset()
  findFirst.mockResolvedValue(null)
  findUnique.mockResolvedValue(null)
  update.mockResolvedValue({})
  upsert.mockRejectedValue(new Error('Unique constraint failed on the fields: (`companyId`,`dedupeKey`)'))
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

describe('an employer lists a title and place again after the old row expired', () => {
  it('reactivates the expired row instead of creating a second one', async () => {
    findMany.mockResolvedValue([stored()])

    const result = await upsertJobsForCompanyFromAts(company, [raw])

    expect(upsert).not.toHaveBeenCalled()
    expect(result.updated).toBe(1)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0].where).toEqual({ id: 'ats:greenhouse:old-1' })
    expect(update.mock.calls[0][0].data.isExpired).toBe(false)
  })

  it('still creates the job when nothing, live or expired, holds that title and place', async () => {
    findMany.mockResolvedValue([])
    upsert.mockResolvedValue({})

    const result = await upsertJobsForCompanyFromAts(company, [raw])

    expect(result.created).toBe(1)
    expect(upsert).toHaveBeenCalledTimes(1)
  })
})
