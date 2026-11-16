// lib/ai/enrichSelection.ts
//
// Which jobs get an LLM rewrite. Not every job: the free tiers allow only about 50 (OpenRouter) to 100 (Cloudflare) a day, so
// the day's budget goes to the jobs most worth it: new, well paid, from a priority employer, with a description long enough to
// have something to structure. Everything else keeps the original description and whatever structure the sources give
// (freehire's own summary, headings parsed by lib/jobs/descriptionStructure.ts). Pure: the caller loads candidates.
import { getHighSalaryThresholdAnnual } from '../currency/thresholds'
import { MAX_DISPLAY_AGE_DAYS } from '../ingest/jobAgeFilter'

export const DEFAULT_DAILY_ENRICH_LIMIT = 100
/** Shorter descriptions have nothing to structure. */
export const MIN_DESCRIPTION_CHARS = 800
/** Only recent jobs: an old job is likely gone by the time its rewrite is read. */
export const MAX_JOB_AGE_DAYS = 3
/**
 * A job visitors actually click stays worth a rewrite for as long as the site still shows it, not only for its first
 * MAX_JOB_AGE_DAYS: a rewrite is read by the people who open the job, and clicks say they do.
 */
export const MAX_CLICKED_JOB_AGE_DAYS = Math.max(MAX_JOB_AGE_DAYS, MAX_DISPLAY_AGE_DAYS)
/** Apply clicks in the last 30 days that make a job count as in demand: one click is a signal, this many is a lot. */
export const HIGH_DEMAND_CLICKS = 5

export type EnrichCandidate = {
  id: string
  createdAt: Date
  postedAt: Date | null
  descriptionHtml: string | null
  aiEnrichedAt: Date | null
  isExpired: boolean
  maxAnnual: bigint | number | null
  currency: string | null
  companySlug?: string | null
  /** Apply clicks on this job in the last 30 days (ApplyClick); absent or 0 when nobody clicked. */
  clicks30d?: number | null
}

const DAY_MS = 86_400_000
const ageDays = (job: EnrichCandidate, now: Date) => (now.getTime() - (job.postedAt ?? job.createdAt).getTime()) / DAY_MS

export function isEnrichable(job: EnrichCandidate, now: Date): boolean {
  return (
    !job.isExpired &&
    !job.aiEnrichedAt &&
    (job.descriptionHtml ?? '').length >= MIN_DESCRIPTION_CHARS &&
    ageDays(job, now) <= ((job.clicks30d ?? 0) > 0 ? MAX_CLICKED_JOB_AGE_DAYS : MAX_JOB_AGE_DAYS)
  )
}

/**
 * Higher is more worth a rewrite: pay as a multiple of the currency's six-figure floor, a priority employer, freshness, and
 * demand (apply clicks): what visitors act on is what they read.
 */
export function enrichmentScore(job: EnrichCandidate, now: Date, priorityCompanySlugs: ReadonlySet<string> = new Set()): number {
  let score = 0
  const threshold = getHighSalaryThresholdAnnual(job.currency)
  const max = job.maxAnnual == null ? null : Number(job.maxAnnual)
  if (threshold && max && Number.isFinite(max)) {
    const ratio = max / threshold
    score += ratio >= 3 ? 3 : ratio >= 2 ? 2 : ratio >= 1.5 ? 1 : 0
  }
  if (job.companySlug && priorityCompanySlugs.has(job.companySlug)) score += 2
  if (ageDays(job, now) <= 1) score += 1
  const clicks = job.clicks30d ?? 0
  if (clicks >= HIGH_DEMAND_CLICKS) score += 3
  else if (clicks >= 1) score += 2
  return score
}

export function selectJobsToEnrich(
  candidates: readonly EnrichCandidate[],
  opts: { limit?: number; now?: Date; priorityCompanySlugs?: ReadonlySet<string> } = {},
): EnrichCandidate[] {
  const now = opts.now ?? new Date()
  const limit = Math.max(0, opts.limit ?? DEFAULT_DAILY_ENRICH_LIMIT)
  return candidates
    .filter((job) => isEnrichable(job, now))
    .map((job) => ({ job, score: enrichmentScore(job, now, opts.priorityCompanySlugs) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.job.postedAt ?? b.job.createdAt).getTime() - (a.job.postedAt ?? a.job.createdAt).getTime() ||
        a.job.id.localeCompare(b.job.id),
    )
    .slice(0, limit)
    .map((x) => x.job)
}
