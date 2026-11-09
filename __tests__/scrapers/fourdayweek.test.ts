jest.mock('../../lib/prisma', () => ({ prisma: {} }))

import { fourDayWeekLocationText, mapFourDayWeekJob, markdownToHtml } from '../../lib/scrapers/fourdayweek'
import type { FourDayWeekApiJob } from '../../lib/jobs/fourDayWeek'

// A real listing's fields (Buffer, 2026-11-09), trimmed.
const listing = (over: Partial<FourDayWeekApiJob> = {}): FourDayWeekApiJob => ({
  id: '01a1ad72-fb63-79c5-935d-0a4e5b57fea8',
  slug: 'lead-security-engineer-at-buffer-59305cff',
  title: 'Lead Security Engineer',
  description: '### About Buffer\n\nWe create **social media** tools.\n\n- Own security\n- Mentor engineers',
  url: 'https://4dayweek.io/job/lead-security-engineer-at-buffer-59305cff',
  schedule_type: '4_day_week',
  hours_per_week_min: 32,
  hours_per_week_max: 32,
  work_arrangement: 'remote',
  salary_min: 17110000,
  salary_max: 22288000,
  salary_currency: 'USD',
  salary_period: 'year',
  posted_at: '2026-11-05T20:42:36Z',
  locations: null,
  skills: [{ slug: 'application-security' }],
  company: { name: 'Buffer', website: 'https://buffer.com/' },
  ...over,
})

describe('4dayweek.io listing to board job', () => {
  it('maps a listing, with pay in dollars (the API gives cents)', () => {
    const job = mapFourDayWeekJob(listing())!
    expect(job.salaryMin).toBe(171100)
    expect(job.salaryMax).toBe(222880)
    expect(job.salaryCurrency).toBe('USD')
    expect(job.url).toBe('https://4dayweek.io/job/lead-security-engineer-at-buffer-59305cff')
    expect(job.applyUrl).toBe(job.url)
    expect(job.rawCompanyName).toBe('Buffer')
    expect(job.isRemote).toBe(true)
    expect(job.locationText).toBe('Remote')
    expect(job.postedAt?.toISOString()).toBe('2026-11-05T20:42:36.000Z')
  })

  it('passes on no pay that is not yearly, and skips compressed or 40-hour weeks', () => {
    expect(mapFourDayWeekJob(listing({ salary_period: 'hour' }))!.salaryMin).toBeNull()
    expect(mapFourDayWeekJob(listing({ schedule_type: 'compressed_week' }))).toBeNull()
    expect(mapFourDayWeekJob(listing({ hours_per_week_max: 40 }))).toBeNull()
  })

  it('writes the location the way our location parser reads it', () => {
    expect(fourDayWeekLocationText({ work_arrangement: 'remote', locations: [{ country: 'United States' }] })).toBe('Remote - United States')
    expect(fourDayWeekLocationText({ work_arrangement: 'hybrid', locations: [{ city: 'Milan', country: 'Italy' }] })).toBe('Milan, Italy')
    expect(fourDayWeekLocationText({ work_arrangement: 'onsite', locations: [] })).toBeNull()
  })

  it('turns the Markdown description into plain HTML and escapes anything else', () => {
    expect(markdownToHtml(listing().description)).toBe(
      '<h3>About Buffer</h3>\n<p>We create <strong>social media</strong> tools.</p>\n<ul><li>Own security</li><li>Mentor engineers</li></ul>',
    )
    expect(markdownToHtml('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
    expect(markdownToHtml('[apply](https://x.com/a"onclick=1)')).not.toContain('onclick=1"')
    expect(markdownToHtml('')).toBeNull()
  })
})
