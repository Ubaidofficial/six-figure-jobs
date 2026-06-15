import { getSiteUrl } from '../seo/site'
import { evaluateJobIndexability } from '../jobs/qualityGate'
import { prisma } from '../prisma'

export function validateJobIndexingUrl(url: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(url)
    const canonicalOrigin = getSiteUrl()

    if (parsed.origin !== canonicalOrigin) {
      return { valid: false, reason: `origin_mismatch (expected ${canonicalOrigin}, got ${parsed.origin})` }
    }

    if (!parsed.pathname.startsWith('/job/')) {
      return { valid: false, reason: 'invalid_pathname_pattern' }
    }

    return { valid: true }
  } catch {
    return { valid: false, reason: 'malformed_url' }
  }
}

export async function verifyJobIndexingUpdateSafety(
  jobId: string,
  url: string,
): Promise<{ safe: boolean; reason?: string }> {
  const urlCheck = validateJobIndexingUrl(url)
  if (!urlCheck.valid) {
    return { safe: false, reason: urlCheck.reason }
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
  })

  if (!job) {
    return { safe: false, reason: 'job_not_found_in_db' }
  }

  if (job.isExpired) {
    return { safe: false, reason: 'job_is_marked_expired' }
  }

  const indexability = evaluateJobIndexability(job)
  if (!indexability.indexable) {
    return { safe: false, reason: `job_failed_quality_gate: ${indexability.reason}` }
  }

  return { safe: true }
}

export async function verifyJobIndexingDeleteSafety(
  jobId: string,
  url: string,
): Promise<{ safe: boolean; reason?: string }> {
  const urlCheck = validateJobIndexingUrl(url)
  if (!urlCheck.valid) {
    return { safe: false, reason: urlCheck.reason }
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
  })

  // Safe to delete if the job is completely gone from the DB (will return 404)
  if (!job) {
    return { safe: true }
  }

  // Safe to delete if the job is expired or stale (will return 410 or noindex)
  if (job.isExpired) {
    return { safe: true }
  }

  const indexability = evaluateJobIndexability(job)
  if (!indexability.indexable) {
    // If it is not indexable, it will have a noindex tag, so it is safe to send URL_DELETED
    return { safe: true }
  }

  // If the job is active and indexable, we should not delete it!
  return { safe: false, reason: 'job_is_still_active_and_indexable' }
}
