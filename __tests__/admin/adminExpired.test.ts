// A job the owner expired by hand must stay expired when its source still lists it (lib/admin/adminExpired.ts); a job the
// automatic checks expired is still reactivated, as before (__tests__/ingest/expiredDedupeKey.test.ts).
const findFirst = jest.fn()
const findMany = jest.fn()
const findUnique = jest.fn()
const update = jest.fn()
const upsert = jest.fn()
const configFind = jest.fn()
jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
      upsert: (...a: unknown[]) => upsert(...a),
    },
    siteConfig: { findUnique: (...a: unknown[]) => configFind(...a) },
  },
}))
jest.mock('../../lib/jobs/indexingQueue', () => ({ enqueueJobIndexingUpdate: jest.fn() }))
jest.mock('../../lib/jobs/indexingNotifications', () => ({ notifyJobInsertedForIndexing: jest.fn() }))

import { __resetAdminExpiredCacheForTests } from '../../lib/admin/adminExpired'
import { makeJobDedupeKey } from '../../lib/ingest/dedupeHelpers'
import { getSourcePriority } from '../../lib/ingest/sourcePriority'
import { upsertJobsForCompanyFromAts } from '../../lib/jobs/ingestFromAts'

const company = { id: 'c1', name: 'Acme', slug: 'acme', atsProvider: 'greenhouse' }
const TITLE = 'Senior Account Executive'
const PLACE = 'Austin, TX'
const stored = {
  id: 'ats:greenhouse:1',
  externalId: '1',
  title: TITLE,
  company: 'Acme',
  companyId: 'c1',
  source: 'ats:greenhouse',
  sourcePriority: getSourcePriority('ats:greenhouse'),
  dedupeKey: makeJobDedupeKey('c1', TITLE, PLACE),
  url: 'https://boards.greenhouse.io/acme/jobs/1',
  applyUrl: 'https://boards.greenhouse.io/acme/jobs/1',
  isExpired: true,
}
const raw = { externalId: '1', title: TITLE, locationText: PLACE, url: stored.url, salaryMin: 150000, salaryMax: 200000, salaryCurrency: 'USD', descriptionHtml: '<p>Sell.</p>' }

beforeEach(() => {
  for (const fn of [findFirst, findMany, findUnique, update, upsert, configFind]) fn.mockReset()
  __resetAdminExpiredCacheForTests()
  findFirst.mockResolvedValue(null)
  findUnique.mockResolvedValue(null)
  findMany.mockResolvedValue([stored])
  update.mockResolvedValue({})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

it('keeps a job expired by hand expired when the source lists it again', async () => {
  configFind.mockResolvedValue({ key: 'admin.expired.jobIds', value: JSON.stringify(['ats:greenhouse:1']) })
  const result = await upsertJobsForCompanyFromAts(company, [raw])
  expect(update).not.toHaveBeenCalled()
  expect(upsert).not.toHaveBeenCalled()
  expect(result.updated).toBe(0)
})

it('expires again a job marked by hand that a racing sync left live', async () => {
  configFind.mockResolvedValue({ key: 'admin.expired.jobIds', value: JSON.stringify(['ats:greenhouse:1']) })
  findMany.mockResolvedValue([{ ...stored, isExpired: false }])
  const result = await upsertJobsForCompanyFromAts(company, [raw])
  expect(update).toHaveBeenCalledTimes(1)
  expect(update.mock.calls[0][0]).toEqual({ where: { id: 'ats:greenhouse:1' }, data: { isExpired: true } })
  expect(result.updated).toBe(0)
})

it('still reactivates a job the checks expired', async () => {
  configFind.mockResolvedValue(null)
  const result = await upsertJobsForCompanyFromAts(company, [raw])
  expect(result.updated).toBe(1)
  expect(update.mock.calls[0][0].data.isExpired).toBe(false)
})
