import type { JobFreshnessInput } from './freshness'
import { isJobFresh } from './freshness'

export type JobDetailAvailabilityInput = JobFreshnessInput & {
  isExpired?: boolean | null
}

export type JobDetailAvailability = 'available' | 'expired' | 'stale'

export function getJobDetailAvailability(
  job: JobDetailAvailabilityInput,
): JobDetailAvailability {
  if (job.isExpired === true) return 'expired'
  return isJobFresh(job) ? 'available' : 'stale'
}

export function isJobDetailAvailable(job: JobDetailAvailabilityInput): boolean {
  return getJobDetailAvailability(job) === 'available'
}
