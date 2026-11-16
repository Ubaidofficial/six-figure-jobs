const ingestJob = jest.fn()
jest.mock('../../lib/ingest', () => ({ ingestJob: (...a: unknown[]) => ingestJob(...a) }))

import { ingestBoardJob } from '../../lib/jobs/ingestBoardJob'
import { mapFreehireJob, type FreehireJob } from '../../lib/scrapers/freehire'

const job: FreehireJob = {
  public_slug: 'engineer-acme-abc',
  external_id: 'acme:1',
  url: 'https://jobs.lever.co/acme/1?utm_source=freehire.me',
  title: 'Platform Engineer',
  company: 'Acme',
  location: 'Foster City, CA',
  description: '<p>Hybrid working.</p>',
  work_mode: 'hybrid',
  posted_at: '2026-11-16T10:00:00Z',
  updated_at: '2026-11-16T10:00:00Z',
  closed_at: null,
  enrichment: { employment_type: 'full_time', salary_min: 165000, salary_max: 204000, salary_currency: 'USD', salary_period: 'year' },
} as FreehireJob

describe('a board\'s structured work mode reaches the ingest', () => {
  beforeEach(() => {
    ingestJob.mockReset()
    ingestJob.mockResolvedValue({ status: 'created' })
  })

  it('freehire hybrid -> workplaceType hybrid (it used to be dropped, and the job was stored as on-site)', async () => {
    await ingestBoardJob('freehire', mapFreehireJob(job)!)
    expect(ingestJob.mock.calls[0][0].workplaceType).toBe('hybrid')
  })

  it('stays null when the board states none, so the location text decides as before', async () => {
    await ingestBoardJob('freehire', mapFreehireJob({ ...job, work_mode: null })!)
    expect(ingestJob.mock.calls[0][0].workplaceType).toBeNull()
  })
})
