import { buildFreshJobWhere, isJobFresh, resolveJobFreshnessDate } from '@/lib/jobs/freshness'
import { MAX_DISPLAY_AGE_DAYS } from '@/lib/ingest/jobAgeFilter'

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

describe('job freshness is measured from the posting date', () => {
  it('defaults to two weeks', () => {
    expect(MAX_DISPLAY_AGE_DAYS).toBe(14)
  })

  it('a job posted long ago is stale even though a scrape saw it again today', () => {
    expect(isJobFresh({ postedAt: daysAgo(60), lastSeenAt: new Date(), createdAt: daysAgo(3) })).toBe(false)
    expect(isJobFresh({ postedAt: daysAgo(10), lastSeenAt: daysAgo(30) })).toBe(true)
  })

  it('with no posting date, the day we first stored the job stands in', () => {
    expect(resolveJobFreshnessDate({ postedAt: null, createdAt: daysAgo(5) })?.getTime()).toBe(daysAgo(5).getTime())
    expect(isJobFresh({ postedAt: null, createdAt: daysAgo(5) })).toBe(true)
    expect(isJobFresh({ postedAt: null, createdAt: daysAgo(40), lastSeenAt: new Date() })).toBe(false)
    expect(isJobFresh({})).toBe(false)
  })

  it('the query filters on postedAt, else createdAt, and never on lastSeenAt', () => {
    const where = buildFreshJobWhere(MAX_DISPLAY_AGE_DAYS, new Date('2026-11-15T12:00:00Z'))
    expect(where).toEqual({
      OR: [{ postedAt: { gte: expect.any(Date) } }, { postedAt: null, createdAt: { gte: expect.any(Date) } }],
    })
    expect(JSON.stringify(where)).not.toContain('lastSeenAt')
  })
})
