// __tests__/seo/googleIndexingApi.test.ts
import { validateJobIndexingUrl, verifyJobIndexingUpdateSafety, verifyJobIndexingDeleteSafety } from '../../lib/indexing/safetyGates'
import { prisma } from '../../lib/prisma'
import { POST as notifyRoutePOST } from '../../app/api/indexing/notify/route'
import { evaluateJobIndexability } from '../../lib/jobs/qualityGate'
import { enqueueJobIndexingUpdate } from '../../lib/jobs/indexingQueue'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    jobIndexingQueue: {
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

jest.mock('../../lib/jobs/qualityGate', () => ({
  evaluateJobIndexability: jest.fn(),
}))

describe('Google Indexing API & Safety Gates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.INDEXING_API_INTERNAL_KEY
    delete process.env.INDEXING_API_DRY_RUN
  })

  describe('URL Validation', () => {
    it('accepts canonical job URLs on production domain', () => {
      const res = validateJobIndexingUrl('https://www.6figjobs.com/job/software-engineer-j-12345')
      expect(res.valid).toBe(true)
    })

    it('rejects external domains', () => {
      const res = validateJobIndexingUrl('https://example.com/job/software-engineer-j-12345')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('origin_mismatch')
    })

    it('rejects non-job paths', () => {
      const res1 = validateJobIndexingUrl('https://www.6figjobs.com/company/google')
      const res2 = validateJobIndexingUrl('https://www.6figjobs.com/blog/seo-tips')
      const res3 = validateJobIndexingUrl('https://www.6figjobs.com/sitemap.xml')

      expect(res1.valid).toBe(false)
      expect(res2.valid).toBe(false)
      expect(res3.valid).toBe(false)
    })
  })

  describe('Safety Gates - Updates', () => {
    it('rejects update if job not found in DB', async () => {
      ;(prisma.job.findUnique as jest.Mock).mockResolvedValue(null)
      const res = await verifyJobIndexingUpdateSafety('job-1', 'https://www.6figjobs.com/job/eng-j-1')
      expect(res.safe).toBe(false)
      expect(res.reason).toBe('job_not_found_in_db')
    })

    it('rejects update if job is expired', async () => {
      ;(prisma.job.findUnique as jest.Mock).mockResolvedValue({ id: 'job-1', isExpired: true })
      const res = await verifyJobIndexingUpdateSafety('job-1', 'https://www.6figjobs.com/job/eng-j-1')
      expect(res.safe).toBe(false)
      expect(res.reason).toBe('job_is_marked_expired')
    })

    it('rejects update if job fails quality gates', async () => {
      ;(prisma.job.findUnique as jest.Mock).mockResolvedValue({ id: 'job-1', isExpired: false })
      ;(evaluateJobIndexability as jest.Mock).mockReturnValue({ indexable: false, reason: 'thin_content' })

      const res = await verifyJobIndexingUpdateSafety('job-1', 'https://www.6figjobs.com/job/eng-j-1')
      expect(res.safe).toBe(false)
      expect(res.reason).toContain('job_failed_quality_gate')
    })

    it('accepts update for active, high-quality jobs', async () => {
      ;(prisma.job.findUnique as jest.Mock).mockResolvedValue({ id: 'job-1', isExpired: false })
      ;(evaluateJobIndexability as jest.Mock).mockReturnValue({ indexable: true })

      const res = await verifyJobIndexingUpdateSafety('job-1', 'https://www.6figjobs.com/job/eng-j-1')
      expect(res.safe).toBe(true)
    })
  })

  describe('Safety Gates - Deletes', () => {
    it('accepts delete if job is missing from DB', async () => {
      ;(prisma.job.findUnique as jest.Mock).mockResolvedValue(null)
      const res = await verifyJobIndexingDeleteSafety('job-1', 'https://www.6figjobs.com/job/eng-j-1')
      expect(res.safe).toBe(true)
    })

    it('accepts delete if job is expired', async () => {
      ;(prisma.job.findUnique as jest.Mock).mockResolvedValue({ id: 'job-1', isExpired: true })
      const res = await verifyJobIndexingDeleteSafety('job-1', 'https://www.6figjobs.com/job/eng-j-1')
      expect(res.safe).toBe(true)
    })

    it('accepts delete if job fails quality/indexability gate', async () => {
      ;(prisma.job.findUnique as jest.Mock).mockResolvedValue({ id: 'job-1', isExpired: false })
      ;(evaluateJobIndexability as jest.Mock).mockReturnValue({ indexable: false, reason: 'thin_content' })

      const res = await verifyJobIndexingDeleteSafety('job-1', 'https://www.6figjobs.com/job/eng-j-1')
      expect(res.safe).toBe(true)
    })

    it('rejects delete if job is active and high-quality', async () => {
      ;(prisma.job.findUnique as jest.Mock).mockResolvedValue({ id: 'job-1', isExpired: false })
      ;(evaluateJobIndexability as jest.Mock).mockReturnValue({ indexable: true })

      const res = await verifyJobIndexingDeleteSafety('job-1', 'https://www.6figjobs.com/job/eng-j-1')
      expect(res.safe).toBe(false)
      expect(res.reason).toBe('job_is_still_active_and_indexable')
    })
  })

  describe('API Route Authentication', () => {
    it('allows access in dev fallback mode from localhost when no internal key is set', async () => {
      const req = new Request('https://localhost/api/indexing/notify', {
        method: 'POST',
        headers: { host: 'localhost' },
        body: JSON.stringify({ urls: [] }),
      })

      const res = await notifyRoutePOST(req)
      expect(res.status).toBe(200)
    })

    it('rejects dev fallback mode if not localhost', async () => {
      const req = new Request('https://www.6figjobs.com/api/indexing/notify', {
        method: 'POST',
        headers: { host: 'www.6figjobs.com' },
        body: JSON.stringify({ urls: [] }),
      })

      const res = await notifyRoutePOST(req)
      expect(res.status).toBe(401)
    })

    it('rejects weak internal keys in production mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
      process.env.INDEXING_API_INTERNAL_KEY = 'shortkey'

      const req = new Request('https://www.6figjobs.com/api/indexing/notify', {
        method: 'POST',
        headers: { authorization: 'Bearer shortkey' },
        body: JSON.stringify({ urls: [] }),
      })

      const res = await notifyRoutePOST(req)
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({
        error: 'Forbidden: Weak or missing INDEXING_API_INTERNAL_KEY in production',
      })

      Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, configurable: true })
    })

    it('accepts correct key and returns structured JSON', async () => {
      process.env.INDEXING_API_INTERNAL_KEY = 'supersecretinternalbearerkey'

      const req = new Request('https://www.6figjobs.com/api/indexing/notify', {
        method: 'POST',
        headers: { authorization: 'Bearer supersecretinternalbearerkey' },
        body: JSON.stringify({ urls: [] }),
      })

      const res = await notifyRoutePOST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('ok')
      expect(data).toHaveProperty('dryRun')
      expect(data).toHaveProperty('accepted')
      expect(data).toHaveProperty('skipped')
      expect(data).toHaveProperty('errors')
    })
  })

  describe('Queue enqueuing & pending updates', () => {
    it('uses upsert to update the URL when the same job is enqueued again while pending', async () => {
      const upsertMock = jest.fn().mockResolvedValue({})
      prisma.jobIndexingQueue.upsert = upsertMock

      ;(prisma.job.findUnique as jest.Mock).mockResolvedValue({ id: 'job-1', title: 'Developer', isExpired: false })
      ;(evaluateJobIndexability as jest.Mock).mockReturnValue({ indexable: true })

      await enqueueJobIndexingUpdate('job-1', 'test_reason')

      expect(upsertMock).toHaveBeenCalledWith({
        where: { dedupeKey: 'job-1:URL_UPDATED:pending' },
        create: {
          jobId: 'job-1',
          url: 'https://www.6figjobs.com/job/developer-j-d91zx2',
          type: 'URL_UPDATED',
          reason: 'test_reason',
          status: 'pending',
          dedupeKey: 'job-1:URL_UPDATED:pending',
        },
        update: {
          url: 'https://www.6figjobs.com/job/developer-j-d91zx2',
          reason: 'test_reason',
          updatedAt: expect.any(Date),
        },
      })
    })
  })
})
