import { jobSitemapLastmod } from '@/lib/seo/jobLastmod'

const NOW = new Date('2026-11-07T12:00:00Z')
const d = (s: string) => new Date(s)

describe('jobSitemapLastmod', () => {
  it('is the later of when we added the job and when the source posted it', () => {
    expect(jobSitemapLastmod({ createdAt: d('2026-11-03T00:00:00Z'), postedAt: d('2026-10-20T00:00:00Z') }, NOW)).toEqual(d('2026-11-03T00:00:00Z'))
    expect(jobSitemapLastmod({ createdAt: d('2026-11-03T00:00:00Z'), postedAt: d('2026-11-05T00:00:00Z') }, NOW)).toEqual(d('2026-11-05T00:00:00Z'))
  })

  it('does not move when the daily sync refreshes updatedAt (the bug this replaces)', () => {
    const base = { createdAt: d('2026-11-03T00:00:00Z'), postedAt: d('2026-11-02T00:00:00Z') }
    const a = jobSitemapLastmod({ ...base, updatedAt: d('2026-11-06T12:00:00Z') }, NOW)
    const b = jobSitemapLastmod({ ...base, updatedAt: d('2026-11-07T12:00:00Z') }, NOW)
    expect(a).toEqual(b)
    expect(a).toEqual(d('2026-11-03T00:00:00Z'))
  })

  it('gives different jobs different dates', () => {
    const a = jobSitemapLastmod({ createdAt: d('2026-11-01T00:00:00Z'), updatedAt: NOW }, NOW)
    const b = jobSitemapLastmod({ createdAt: d('2026-11-04T00:00:00Z'), updatedAt: NOW }, NOW)
    expect(a.getTime()).not.toBe(b.getTime())
  })

  it('ignores a date in the future (a bad source date must not promise change that has not happened)', () => {
    expect(jobSitemapLastmod({ createdAt: d('2026-11-03T00:00:00Z'), postedAt: d('2027-01-01T00:00:00Z') }, NOW)).toEqual(d('2026-11-03T00:00:00Z'))
  })

  it('falls back to updatedAt, then to now, only when no publish date is known', () => {
    expect(jobSitemapLastmod({ updatedAt: d('2026-11-05T00:00:00Z') }, NOW)).toEqual(d('2026-11-05T00:00:00Z'))
    expect(jobSitemapLastmod({}, NOW)).toEqual(NOW)
    expect(jobSitemapLastmod({ createdAt: null, postedAt: new Date('nope'), updatedAt: null }, NOW)).toEqual(NOW)
  })
})
