// app/feeds/jobs.rss/route.ts
// Public RSS feed of the 100 newest $100k+ jobs (lib/feeds/jobsRss.ts). Cached 30 minutes in-process and an hour at
// the CDN; noindex so the feed never competes with the job pages it links to.
import { serveJobsRss } from '@/lib/feeds/serveJobsRss'

export const dynamic = 'force-dynamic'

export function GET() {
  return serveJobsRss({
    key: 'feed:rss:jobs',
    input: {},
    title: 'Six Figure Jobs: newest $100k+ jobs',
    description: 'The newest jobs paying $100k+ (or the local equivalent) with a published salary.',
    selfPath: '/feeds/jobs.rss',
  })
}
