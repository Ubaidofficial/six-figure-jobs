// app/feeds/jobs.rss/route.ts
// Public RSS feed of the 100 newest $100k+ jobs (lib/feeds/jobsRss.ts), or of one search with ?q= (the "Follow this
// search" chip on /jobs). Cached 30 minutes in-process and an hour at the CDN; noindex so the feed never competes with
// the job pages it links to.
import { serveJobsRss } from '@/lib/feeds/serveJobsRss'

export const dynamic = 'force-dynamic'

const MAX_QUERY_LENGTH = 60

export function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH)
  if (q) {
    return serveJobsRss({
      key: `feed:rss:jobs:q:${q.toLowerCase()}`,
      input: { keyword: q },
      title: `Six Figure Jobs: newest $100k+ jobs matching "${q}"`,
      description: `The newest jobs matching "${q}" that pay $100k+ (or the local equivalent) with a published salary.`,
      selfPath: `/feeds/jobs.rss?${new URLSearchParams({ q }).toString()}`,
    })
  }
  return serveJobsRss({
    key: 'feed:rss:jobs',
    input: {},
    title: 'Six Figure Jobs: newest $100k+ jobs',
    description: 'The newest jobs paying $100k+ (or the local equivalent) with a published salary.',
    selfPath: '/feeds/jobs.rss',
  })
}
