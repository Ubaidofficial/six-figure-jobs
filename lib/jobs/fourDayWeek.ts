// lib/jobs/fourDayWeek.ts
//
// Four-day-week jobs: reduced hours (usually 32) at full pay. 4dayweek.io labels every listing with a schedule type and
// publishes the labels through a free public API (https://4dayweek.io/developers; 60 requests a minute, asks for a
// link back). Only `4_day_week` is a four-day week: a `compressed_week` is the same 40 hours in four days, and most of
// the site's listings are neither. freehire carries some 4dayweek.io listings, but without the label, so a job's
// source never says whether it is a four-day week; the list of labelled listings does.
//
// A job of ours is a four-day-week job when it is one of those listings: its posting URL is the listing's URL (jobs
// imported from 4dayweek.io or by freehire), or it is the same company and title (the same job read from the
// employer's own careers system). No column marks it, so no migration is needed and the label stays current.

import type { Prisma } from '@prisma/client'

import { memoAsync } from '../cache/memo'

export const FOUR_DAY_WEEK_API = 'https://4dayweek.io/api/v2/jobs'
export const FOUR_DAY_WEEK_PATH = '/jobs/4-day-week'
/** The page is indexable (and in the sitemap) only with at least this many jobs; fewer is a thin page. */
export const FOUR_DAY_WEEK_MIN_JOBS_TO_INDEX = 5

const PAGE_LIMIT = 100 // the API's maximum
const MAX_PAGES = 20 // 643 listings on 2026-11-09 fill 7 pages
const LISTINGS_TTL_MS = 6 * 60 * 60 * 1000

export type FourDayWeekApiJob = {
  id: string
  slug: string
  title: string
  description?: string | null
  url: string
  schedule_type: string
  hours_per_week_min?: number | null
  hours_per_week_max?: number | null
  work_arrangement?: string | null
  salary_min?: number | null // minor units (cents)
  salary_max?: number | null
  salary_currency?: string | null
  salary_period?: string | null
  posted_at?: string | null
  locations?: Array<{ city?: string | null; country?: string | null; work_arrangement?: string | null }> | null
  skills?: Array<{ slug: string }> | null
  company: { name: string; website?: string | null; logo_url?: string | null }
}

export type FourDayWeekListing = { url: string; title: string; company: string }

type Page = { data: FourDayWeekApiJob[]; has_more: boolean }

/** Every live listing 4dayweek.io labels `4_day_week`. */
export async function fetchFourDayWeekJobs(fetchImpl: typeof fetch = fetch): Promise<FourDayWeekApiJob[]> {
  const out: FourDayWeekApiJob[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetchImpl(`${FOUR_DAY_WEEK_API}?schedule=4_day_week&limit=${PAGE_LIMIT}&page=${page}`, {
      headers: { 'User-Agent': '6FigJobs/1.0 (+https://www.6figjobs.com)', accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      // Discard the unread body: left paused, it crashed undici when the server closed the connection (2026-11-10).
      await res.body?.cancel().catch(() => undefined)
      throw new Error(`4dayweek.io API ${res.status} on page ${page}`)
    }
    const body = (await res.json()) as Page
    out.push(...body.data.filter(isReducedHoursFourDayWeek))
    if (!body.has_more) break
  }
  return out
}

/**
 * A listing labelled `4_day_week` with fewer than 40 hours. The label is checked again so a changed API cannot widen the
 * list, and 40 hours is a compressed week whatever its label (4 of the 643 labelled listings on 2026-11-09; 443 were
 * 32 hours and most of the rest 34-37).
 */
export function isReducedHoursFourDayWeek(job: Pick<FourDayWeekApiJob, 'schedule_type' | 'hours_per_week_min' | 'hours_per_week_max'>): boolean {
  if (job.schedule_type !== '4_day_week') return false
  const hours = job.hours_per_week_max ?? job.hours_per_week_min
  return typeof hours !== 'number' || hours < 40
}

let lastGood: FourDayWeekListing[] | null = null

/** The labelled listings (URL, title, company), cached for 6 hours; the last good list is kept if a refresh fails. */
export async function loadFourDayWeekListings(): Promise<FourDayWeekListing[]> {
  try {
    const listings = await memoAsync('four-day-week-listings', LISTINGS_TTL_MS, async () =>
      (await fetchFourDayWeekJobs()).map((j) => ({ url: j.url, title: j.title, company: j.company.name })),
    )
    lastGood = listings
    return listings
  } catch (error) {
    if (lastGood) return lastGood
    throw error
  }
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Our jobs that are one of the listings: same posting URL, or same company and title. Matches nothing for none. */
export function fourDayWeekWhere(listings: readonly FourDayWeekListing[]): Prisma.JobWhereInput {
  if (listings.length === 0) return { id: { in: [] } }
  const urls = Array.from(new Set(listings.flatMap((l) => [l.url, `${l.url.replace(/\/+$/, '')}/`])))
  const pairs = new Map<string, { company: string; title: string }>()
  for (const l of listings) {
    const company = norm(l.company)
    const title = norm(l.title)
    if (company && title) pairs.set(`${company.toLowerCase()}\u0000${title.toLowerCase()}`, { company, title })
  }
  return {
    OR: [
      { url: { in: urls } },
      { applyUrl: { in: urls } },
      ...Array.from(pairs.values()).map(({ company, title }) => ({
        AND: [
          { company: { equals: company, mode: 'insensitive' as const } },
          { title: { equals: title, mode: 'insensitive' as const } },
        ],
      })),
    ],
  }
}
