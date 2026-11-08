// lib/jobs/latestFeed.ts
//
// The homepage "live feed": the newest jobs we added, in the shape a small client component can poll for. Real data
// only: the order and the times are when WE added each job (createdAt), the same date-first ranking the homepage list
// uses. Loaded at most once a minute per server instance, however many visitors poll.

import { memoAsync } from '@/lib/cache/memo'
import { buildLogoUrl } from '@/lib/companies/logo'
import { buildJobSlugHref } from '@/lib/jobs/jobSlug'
import { queryJobs, type JobWithCompany } from '@/lib/jobs/queryJobs'
import { buildSalaryText } from '@/lib/jobs/salary'
import { describeJobLocation } from '@/lib/location/jobLocation'
import { isHomepageFeatured } from '@/lib/jobs/latestSelection'

export const LATEST_FEED_TTL_MS = 60 * 1000
export const FEED_SIZE = 12
const MAX_PER_COMPANY = 2

export type FeedItem = {
  id: string
  href: string
  title: string
  company: string
  logo: string | null
  salary: string | null
  location: string | null
  countryCode: string | null
  /** ISO time we added the job. */
  addedAt: string
}

export type LatestFeed = { items: FeedItem[]; newestAt: string | null }

const toKCase = (text: string) => text.replace(/(\d)K\b/g, '$1k')

/** Newest-first jobs as feed items: one employer cannot fill the list (a bulk import posts dozens at once). */
export function buildFeedItems(jobs: JobWithCompany[], limit = FEED_SIZE): FeedItem[] {
  const out: FeedItem[] = []
  const seen = new Set<string>()
  const perCompany = new Map<string, number>()
  // Featured jobs (English, with a real role) are taken first; the list is put back in newest-first order below.
  const ordered = [...jobs.filter((j) => isHomepageFeatured(j as any)), ...jobs.filter((j) => !isHomepageFeatured(j as any))]
  for (const job of ordered) {
    const added = job.createdAt ?? job.postedAt ?? job.updatedAt
    if (!added) continue
    const company = String(job.companyRef?.name ?? job.company ?? '').trim() || 'A hiring company'
    const companyKey = job.companyId || job.companyRef?.id || company.toLowerCase()
    const title = (job.title || '').trim()
    const dupeKey = `${companyKey}:${title.toLowerCase()}`
    if (!title || seen.has(dupeKey)) continue
    if ((perCompany.get(companyKey) ?? 0) >= MAX_PER_COMPANY) continue
    seen.add(dupeKey)
    perCompany.set(companyKey, (perCompany.get(companyKey) ?? 0) + 1)

    const salary = buildSalaryText(job)
    const where = describeJobLocation(job)
    out.push({
      id: job.id,
      href: buildJobSlugHref(job),
      title,
      company,
      logo: buildLogoUrl(job.companyRef?.logoUrl ?? job.companyLogo ?? null, job.companyRef?.website ?? null, company),
      salary: salary ? toKCase(salary) : null,
      location: where.compact ?? where.text ?? null,
      countryCode: where.countryCode ?? null,
      addedAt: new Date(added).toISOString(),
    })
    if (out.length >= limit) break
  }
  return out.sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
}

export function newestAddedAt(items: ReadonlyArray<Pick<FeedItem, 'addedAt'>>): string | null {
  let best: string | null = null
  for (const i of items) if (!best || Date.parse(i.addedAt) > Date.parse(best)) best = i.addedAt
  return best
}

export function loadLatestFeed(): Promise<LatestFeed> {
  return memoAsync('latest-feed', LATEST_FEED_TTL_MS, async () => {
    // Same population as the homepage list.
    const { jobs } = await queryJobs({ isHundredKLocal: true, page: 1, pageSize: 40, sortBy: 'date', excludeInternships: true })
    const items = buildFeedItems(jobs as JobWithCompany[])
    return { items, newestAt: newestAddedAt(items) }
  })
}

/** "just now", "5 min ago", "3 hr ago", "2 days ago". Pure, so the client can tick it and the tests can pin the clock. */
export function formatAgo(iso: string, nowMs: number): string {
  const ms = nowMs - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 60_000) return 'just now'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  return `${day} ${day === 1 ? 'day' : 'days'} ago`
}
