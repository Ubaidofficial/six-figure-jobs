import { NEW_THIS_WEEK_DAYS, newThisWeekClause, postedSinceClause } from '../../lib/jobs/postedRecently'

describe('newThisWeekClause', () => {
  it('counts a job by its posting date, else the day it was first seen, and never by sync timestamps', () => {
    const now = new Date('2026-11-06T12:00:00Z')
    const since = new Date('2026-10-30T12:00:00Z')
    const clause = newThisWeekClause(now)
    expect(clause).toEqual({
      OR: [{ postedAt: { gte: since } }, { postedAt: null, createdAt: { gte: since } }],
    })
    const text = JSON.stringify(clause)
    expect(text).not.toContain('lastSeenAt')
    expect(text).not.toContain('updatedAt')
  })

  it('looks back seven days', () => {
    expect(NEW_THIS_WEEK_DAYS).toBe(7)
  })

  it('createdAt only applies to jobs with no posting date', () => {
    const since = new Date('2026-10-30T00:00:00Z')
    const [byPosted, byCreated] = postedSinceClause(since).OR
    expect(byPosted).toEqual({ postedAt: { gte: since } })
    expect(byCreated.postedAt).toBeNull()
  })
})
