import {
  FOUR_DAY_WEEK_PATH,
  fetchFourDayWeekJobs,
  fourDayWeekWhere,
  isReducedHoursFourDayWeek,
  type FourDayWeekApiJob,
} from '../../lib/jobs/fourDayWeek'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { ALWAYS_INDEXABLE_HUBS } from '../../lib/seo/indexingPhase'

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))

const job = (over: Partial<FourDayWeekApiJob> = {}): FourDayWeekApiJob => ({
  id: 'id-1',
  slug: 'lead-security-engineer-at-buffer-59305cff',
  title: 'Lead Security Engineer',
  url: 'https://4dayweek.io/job/lead-security-engineer-at-buffer-59305cff',
  schedule_type: '4_day_week',
  hours_per_week_min: 32,
  hours_per_week_max: 32,
  company: { name: 'Buffer' },
  ...over,
})

describe('which listings are four-day weeks', () => {
  it('keeps reduced hours, drops compressed weeks and 40-hour weeks whatever their label', () => {
    expect(isReducedHoursFourDayWeek(job())).toBe(true)
    expect(isReducedHoursFourDayWeek(job({ hours_per_week_min: 36, hours_per_week_max: 36 }))).toBe(true)
    expect(isReducedHoursFourDayWeek(job({ hours_per_week_min: null, hours_per_week_max: null }))).toBe(true)
    expect(isReducedHoursFourDayWeek(job({ schedule_type: 'compressed_week' }))).toBe(false)
    expect(isReducedHoursFourDayWeek(job({ hours_per_week_min: 40, hours_per_week_max: 40 }))).toBe(false)
  })

  it('reads every page of the API and keeps only the four-day weeks', async () => {
    const pages = [
      { data: [job(), job({ id: 'c', schedule_type: 'compressed_week' })], has_more: true },
      { data: [job({ id: 'x', hours_per_week_max: 40 }), job({ id: 'd' })], has_more: false },
    ]
    const calls: string[] = []
    const fake = (async (url: string) => {
      calls.push(url)
      return { ok: true, json: async () => pages[calls.length - 1] }
    }) as unknown as typeof fetch
    const out = await fetchFourDayWeekJobs(fake)
    expect(out.map((j) => j.id)).toEqual(['id-1', 'd'])
    expect(calls).toHaveLength(2)
    expect(calls[0]).toContain('schedule=4_day_week')
    expect(calls[1]).toContain('page=2')
  })

  it('fails loudly on an API error, so the cached list is kept', async () => {
    const fake = (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch
    await expect(fetchFourDayWeekJobs(fake)).rejects.toThrow('503')
  })
})

describe('matching our jobs to the listings', () => {
  const listings = [{ url: 'https://4dayweek.io/job/lead-security-engineer-at-buffer-59305cff', title: 'Lead Security Engineer', company: 'Buffer' }]

  it('matches by the posting URL (with or without a trailing slash) or by company and title', () => {
    const where = json(fourDayWeekWhere(listings))
    expect(where).toContain('"url":{"in":["https://4dayweek.io/job/lead-security-engineer-at-buffer-59305cff","https://4dayweek.io/job/lead-security-engineer-at-buffer-59305cff/"]}')
    expect(where).toContain('"company":{"equals":"Buffer","mode":"insensitive"}')
    expect(where).toContain('"title":{"equals":"Lead Security Engineer","mode":"insensitive"}')
  })

  it('matches nothing when there are no listings (never every job)', () => {
    expect(fourDayWeekWhere([])).toEqual({ id: { in: [] } })
  })

  it('is part of buildWhere when asked for, on top of the usual public-job rules', () => {
    expect(json(buildWhere({ fourDayWeek: listings }))).toContain('lead-security-engineer-at-buffer')
    expect(json(buildWhere({}))).not.toContain('4dayweek.io')
  })

  it('is an indexable hub', () => {
    expect(ALWAYS_INDEXABLE_HUBS.has(FOUR_DAY_WEEK_PATH)).toBe(true)
    expect(FOUR_DAY_WEEK_PATH).toBe('/jobs/4-day-week')
  })
})
