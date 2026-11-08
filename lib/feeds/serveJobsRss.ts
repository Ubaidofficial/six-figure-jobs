// lib/feeds/serveJobsRss.ts
// Shared handler of the public RSS feeds: the newest public jobs for a filter, as RSS 2.0.
import { memoAsync } from '@/lib/cache/memo'
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
}): Promise<Response> {
  try {
    const xml = await memoAsync(opts.key, 30 * 60 * 1000, async () => {
      const { jobs } = await queryJobs({ ...opts.input, excludeInternships: true, sortBy: 'date', page: 1, pageSize: FEED_SIZE })
      return buildJobsRss(jobs as JobWithCompany[], {
        siteUrl: getSiteUrl(),
        title: opts.title,
        description: opts.description,
        selfPath: opts.selfPath,
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
