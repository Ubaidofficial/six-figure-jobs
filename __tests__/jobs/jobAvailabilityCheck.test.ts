import { checkJobAvailability } from '../../lib/jobs/jobAvailabilityCheck'
import { prisma } from '../../lib/prisma'
import { MAX_INDEXABLE_JOB_AGE_DAYS } from '../../lib/jobs/freshness'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    job: {
      findFirst: jest.fn(),
    },
  },
}))

const findFirst = prisma.job.findFirst as jest.Mock

beforeEach(() => {
  findFirst.mockReset()
})

describe('checkJobAvailability', () => {
  it("returns 'missing' when slug doesn't parse to any identifier", async () => {
    expect(await checkJobAvailability('completely-opaque-slug-with-no-suffix')).toBe('missing')
    expect(findFirst).not.toHaveBeenCalled()
  })

  it("returns 'missing' when the slug resolves but no row exists", async () => {
    findFirst.mockResolvedValue(null)
    expect(await checkJobAvailability('staff-engineer-j-abc12345')).toBe('missing')
  })

  it("returns 'expired' when the row is flagged isExpired", async () => {
    findFirst.mockResolvedValue({
      id: 'job-1',
      isExpired: true,
      lastSeenAt: new Date(),
      postedAt: new Date(),
      createdAt: new Date(),
    })
    expect(await checkJobAvailability('staff-engineer-j-abc12345')).toBe('expired')
  })

  it("returns 'stale' for jobs with no fresh signal in MAX_INDEXABLE_JOB_AGE_DAYS", async () => {
    const old = new Date(Date.now() - (MAX_INDEXABLE_JOB_AGE_DAYS + 5) * 24 * 60 * 60 * 1000)
    findFirst.mockResolvedValue({
      id: 'job-2',
      isExpired: false,
      lastSeenAt: null,
      postedAt: old,
      createdAt: old,
    })
    expect(await checkJobAvailability('staff-engineer-j-abc12345')).toBe('stale')
  })

  it("returns 'available' for live, fresh jobs", async () => {
    findFirst.mockResolvedValue({
      id: 'job-3',
      isExpired: false,
      lastSeenAt: new Date(),
      postedAt: new Date(),
      createdAt: new Date(),
    })
    expect(await checkJobAvailability('staff-engineer-j-abc12345')).toBe('available')
  })
})
