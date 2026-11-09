// lib/jobs/salaryBandSamples.ts
//
// A few real, recently added roles for each salary band in the homepage hero panel. It follows the same rule as the band
// counts (salaryMidpoint, USD listings only), so a role listed under a band is one of the jobs that band's count includes.
// The pool is the newest jobs, so a rare band (the highest one) can have fewer than three roles, or none.

import { memoAsync } from '@/lib/cache/memo'
import { buildFeedItems, type FeedItem } from '@/lib/jobs/latestFeed'
import { queryJobs, type JobWithCompany } from '@/lib/jobs/queryJobs'
import { salaryMidpoint, type SalaryBand } from '@/lib/jobs/salarySnapshot'

export const BAND_SAMPLE_SIZE = 3
export const BAND_SAMPLES_TTL_MS = 10 * 60 * 1000
/** queryJobs caps a page at 100 jobs, so the pool of newest jobs is read in this many pages. */
const POOL_PAGES = 3

/**
 * Pure: jobs sorted into the bands (ascending lower edges), as feed items, one array per band. `jobs` must be newest
 * first, as queryJobs returns them: each band keeps the first few it is given, and shows them newest first.
 */
export function pickBandSamples(
  jobs: ReadonlyArray<JobWithCompany>,
  bands: ReadonlyArray<Pick<SalaryBand, 'min'>>,
  perBand: number = BAND_SAMPLE_SIZE,
): FeedItem[][] {
  const buckets: JobWithCompany[][] = bands.map(() => [])
  for (const job of jobs) {
    if (job.currency !== 'USD') continue
    const mid = salaryMidpoint(job.minAnnual, job.maxAnnual)
    if (mid === null) continue
    // Edges ascend, so the last edge the midpoint reaches is its band. Below the first edge it belongs to none.
    let index = -1
    for (let i = 0; i < bands.length; i++) if (mid >= bands[i].min) index = i
    if (index >= 0) buckets[index].push(job)
  }
  return buckets.map((bucket) => buildFeedItems(bucket, perBand))
}

export function loadBandSamples(bands: ReadonlyArray<Pick<SalaryBand, 'min'>>): Promise<FeedItem[][]> {
  // The band edges come from the snapshot's default floor and do not change between requests, so the key has no bands.
  return memoAsync('home:band-samples', BAND_SAMPLES_TTL_MS, async () => {
    const pages = await Promise.all(
      Array.from({ length: POOL_PAGES }, (_, i) =>
        queryJobs({ isHundredKLocal: true, page: i + 1, pageSize: 100, sortBy: 'date', excludeInternships: true }),
      ),
    )
    return pickBandSamples(pages.flatMap((p) => p.jobs as JobWithCompany[]), bands)
  })
}
