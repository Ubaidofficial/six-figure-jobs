// lib/jobs/latestFeed.ts
//
// The homepage "live feed": the newest jobs we added, in the shape a small client component can poll for. Real data
// only: the order and the times are when WE added each job (createdAt), the same date-first ranking the homepage list
// uses. Loaded at most every 15 seconds per server instance, however many visitors poll (the feed asks every 20 s).

import { memoAsync } from '@/lib/cache/memo'
import { buildLogoUrl } from '@/lib/companies/logo'
import { buildJobSlugHref } from '@/lib/jobs/jobSlug'
import { buildWhere, jobListingSelect, type JobWithCompany } from '@/lib/jobs/queryJobs'
import { newThisWeekClause } from '@/lib/jobs/postedRecently'
import { prisma } from '@/lib/prisma'
import { buildSalaryText } from '@/lib/jobs/salary'
import { describeJobLocation } from '@/lib/location/jobLocation'
import { isHomepageFeatured } from '@/lib/jobs/latestSelection'
import { publicJobId } from './publicJob'

export const LATEST_FEED_TTL_MS = 15 * 1000
export const FEED_SIZE = 20
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

export type LatestFeed = {
  items: FeedItem[]
  newestAt: string | null
  /** Listed jobs we added in the last hour (all of them, not only the ones in the feed); null when it could not be counted. */
  addedLastHour: number | null
}

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
      id: publicJobId(job.id),
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
    // The jobs we added most recently, among listed jobs posted in the last week. It took the 40 most recently POSTED jobs
    // until 2026-11-24 and labelled them by when we added them: freehire finds many jobs a day or more after their posting
    // date, so most jobs added during the day never reached the feed (about 15 an hour shown, while the import added many
    // more). The posting-date limit keeps an old posting found late from reading as one of the latest.
    const listed = buildWhere({ isHundredKLocal: true, excludeInternships: true, page: 1, pageSize: 40 })
    const hourAgo = new Date(Date.now() - 60 * 60_000)
    const [jobs, addedLastHour] = await Promise.all([
      prisma.job.findMany({
        where: { AND: [listed, newThisWeekClause()] },
        select: jobListingSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 40,
      }),
      prisma.job.count({ where: { AND: [listed, { createdAt: { gte: hourAgo } }] } }).catch(() => null),
    ])
    const items = buildFeedItems(jobs as unknown as JobWithCompany[])
    return { items, newestAt: newestAddedAt(items), addedLastHour }
  })
}

export { formatAgo } from './formatAgo'
