// lib/jobs/jobSlug.ts

/**
 * Helpers for building + parsing job detail URLs.
 *
 * Canonical pattern:
 *   /job/<title-and-company-slug>-job-<job.id>
 *
 * Job IDs can be:
 *   - "ats:greenhouse:6427442" (ATS jobs)
 *   - "board:remoteok:123456" (board jobs)
 *   - "cmj123abc" (other formats)
 */

export type JobSlugSource = {
  id: string
  title?: string | null
  company?: string | null
  companyRef?: {
    name?: string | null
  } | null
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildJobSlug(job: JobSlugSource): string {
  const parts: string[] = []

  if (job.title) parts.push(job.title)
  const companyName = job.companyRef?.name ?? job.company ?? null
  if (companyName) parts.push(companyName)

  const raw = parts.join(' ')
  const base = raw || 'job'

  return `${slugify(base)}-job-${job.id}`
}

export function buildJobSlugHref(job: JobSlugSource): string {
  return `/job/${buildJobSlug(job)}`
}

/**
 * Parse "[slug]" route param and recover identifiers.
 * 
 * Handles URL-encoded colons (%3A) in job IDs.
 */
export function parseJobSlugParam(
  param: string
): { jobId: string | null; externalId: string | null } {
  // URL decode the param (colons may be encoded as %3A)
  const decoded = decodeURIComponent(param)
  
  const lastSegment = decoded.split('/').pop() || decoded

  const match = lastSegment.match(/-job-(.+)$/)
  if (!match) {
    return { jobId: null, externalId: null }
  }

  const idPart = match[1]

  // Extract externalId (last part after colon) for fallback lookups
  let externalId: string | null = null
  if (idPart.includes(':')) {
    const parts = idPart.split(':')
    externalId = parts[parts.length - 1]
  }

  return { 
    jobId: idPart || null, 
    externalId: externalId 
  }
}