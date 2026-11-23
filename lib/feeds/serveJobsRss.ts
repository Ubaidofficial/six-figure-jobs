// lib/feeds/serveJobsRss.ts
// Shared handler of the public RSS feeds: the newest public jobs for a filter, as RSS 2.0.
import { memoAsync } from '@/lib/cache/memo'
import { prisma } from '@/lib/prisma'
import { queryJobs, type JobQueryInput, type JobWithCompany } from '@/lib/jobs/queryJobs'
import { getSiteUrl } from '@/lib/seo/site'

import { buildJobsRss } from './jobsRss'

const FEED_SIZE = 100

export async function serveJobsRss(opts: {
  key: string
  input: Omit<JobQueryInput, 'page' | 'pageSize'>
  title: string
  description: string
  selfPath: string
  /**
   * Each job's full description in its item (for job aggregators). Only the fixed feeds ask for it: a feed is about
   * 1 MB with descriptions, and the in-process cache keeps up to 2,000 entries, so one per ?q= search would not fit.
   */
  fullDescriptions?: boolean
}): Promise<Response> {
  try {
    const xml = await memoAsync(opts.key, 30 * 60 * 1000, async () => {
      const { jobs } = await queryJobs({ ...opts.input, excludeInternships: true, sortBy: 'date', page: 1, pageSize: FEED_SIZE })
      let items = jobs as JobWithCompany[]
      if (opts.fullDescriptions && items.length > 0) {
        // The listing query leaves descriptions out; one query for the page's 100, once per cache period.
        const rows = await prisma.job.findMany({ where: { id: { in: items.map((j) => j.id) } }, select: { id: true, descriptionHtml: true } })
        const html = new Map(rows.map((r) => [r.id, r.descriptionHtml]))
        items = items.map((j) => ({ ...j, descriptionHtml: html.get(j.id) ?? null }))
      }
      return buildJobsRss(items, {
        siteUrl: getSiteUrl(),
        title: opts.title,
        description: opts.description,
        selfPath: opts.selfPath,
        fullDescriptions: opts.fullDescriptions,
      })
    })
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch {
    return new Response('Feed temporarily unavailable', { status: 503, headers: { 'Retry-After': '300' } })
  }
}
