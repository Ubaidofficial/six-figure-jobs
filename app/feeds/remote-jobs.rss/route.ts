// app/feeds/remote-jobs.rss/route.ts
// Public RSS feed of the 100 newest remote $100k+ jobs (lib/feeds/jobsRss.ts). Same caching and noindex as jobs.rss.
import { serveJobsRss } from '@/lib/feeds/serveJobsRss'

export const dynamic = 'force-dynamic'

export function GET() {
  return serveJobsRss({
    key: 'feed:rss:remote-jobs',
    input: { remoteOnly: true },
    title: 'Six Figure Jobs: newest remote $100k+ jobs',
    description: 'The newest remote jobs paying $100k+ (or the local equivalent) with a published salary.',
    selfPath: '/feeds/remote-jobs.rss',
  })
}
