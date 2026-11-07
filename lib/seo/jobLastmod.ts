// lib/seo/jobLastmod.ts
//
// The `lastmod` for one job URL in the jobs sitemap.
//
// It used to be the job's `updatedAt`, which the daily sync refreshes on every live job to keep it alive, so 97% of the
// URLs carried the same timestamp and Google (which ignores `lastmod` when it is always "now") got no freshness signal.
// A job page's content is fixed when the job is published, so its date is when we added it or the source posted it,
// whichever is later, never in the future. Only when neither is known do we fall back to `updatedAt`.

export type JobDates = {
  createdAt?: Date | null
  postedAt?: Date | null
  updatedAt?: Date | null
}

const valid = (d: Date | null | undefined, now: number): number | null => {
  if (!d) return null
  const t = d.getTime()
  return Number.isFinite(t) && t <= now ? t : null
}

export function jobSitemapLastmod(job: JobDates, now: Date = new Date()): Date {
  const t = now.getTime()
  const published = [valid(job.createdAt, t), valid(job.postedAt, t)].filter((x): x is number => x !== null)
  if (published.length > 0) return new Date(Math.max(...published))
  return job.updatedAt ?? now
}
