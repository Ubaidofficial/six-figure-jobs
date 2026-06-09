// lib/jobs/jobAvailabilityCheck.ts
//
// Resolves a /job/[slug] URL to a coarse availability state so the request layer
// (middleware) can choose the right HTTP status:
//   - 'available' → let the page render (200)
//   - 'expired'   → 410 Gone (job was withdrawn / source expiry hit)
//   - 'stale'     → 410 Gone (no fresh signal in MAX_INDEXABLE_JOB_AGE_DAYS)
//   - 'missing'   → 404 Not Found (slug didn't resolve to any job)
//
// Google treats 410 as a fast-removal signal; 404 takes weeks to clear and
// keeps re-crawling. Without this distinction the GSC "Not found (404)" report
// accumulates expired jobs even after they're removed from the sitemap.

import { prisma } from '../prisma'
import { parseJobSlugParam } from './jobSlug'
import { isJobFresh } from './freshness'

export type JobAvailability = 'available' | 'expired' | 'stale' | 'missing'

export async function checkJobAvailability(slug: string): Promise<JobAvailability> {
  const { jobId, externalId, shortId } = parseJobSlugParam(slug)

  const ors: any[] = []
  if (jobId) ors.push({ id: jobId })
  if (externalId) ors.push({ externalId })
  if (shortId) ors.push({ shortId })

  if (ors.length === 0) return 'missing'

  const where = ors.length === 1 ? ors[0] : { OR: ors }

  const job = await prisma.job.findFirst({
    where,
    select: {
      id: true,
      isExpired: true,
      lastSeenAt: true,
      postedAt: true,
      createdAt: true,
    },
  })

  if (!job) return 'missing'
  if (job.isExpired === true) return 'expired'
  if (!isJobFresh(job)) return 'stale'
  return 'available'
}
