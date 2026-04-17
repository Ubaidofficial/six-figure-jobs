import {
  getJobDetailAvailability,
  isJobDetailAvailable,
} from '../../lib/jobs/detailAvailability'

const baseJob = {
  isExpired: false,
  lastSeenAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
}

describe('job detail availability', () => {
  it('keeps fresh active jobs available', () => {
    expect(getJobDetailAvailability(baseJob)).toBe('available')
    expect(isJobDetailAvailable(baseJob)).toBe(true)
  })

  it('marks expired jobs as expired', () => {
    const job = { ...baseJob, isExpired: true }

    expect(getJobDetailAvailability(job)).toBe('expired')
    expect(isJobDetailAvailable(job)).toBe(false)
  })

  it('marks stale jobs as unavailable even when not expired', () => {
    const job = {
      ...baseJob,
      lastSeenAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    }

    expect(getJobDetailAvailability(job)).toBe('stale')
    expect(isJobDetailAvailable(job)).toBe(false)
  })
})
