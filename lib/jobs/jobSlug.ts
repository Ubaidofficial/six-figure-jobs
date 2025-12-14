// lib/jobs/jobSlug.ts

/**
 * Canonical pattern (v2.7):
 *   /job/<title-slug>-jid-<base64url(job.id)>
 *
 * - Stable: based on title (not company) + encoded id
 * - URL-safe: no ":" in URLs
 * - Reversible: we can decode token back to original job.id
 * - Backwards compatible: still parses legacy "-job-<raw id>" slugs
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
  return (text || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function truncateSlug(slug: string, maxLen = 80): string {
  if (slug.length <= maxLen) return slug
  const cut = slug.slice(0, maxLen)
  const lastDash = cut.lastIndexOf('-')
  return (lastDash > 30 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '')
}

/**
 * Base64url encode/decode (URL-safe base64 without padding)
 */
function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  return Buffer.from(b64 + pad, 'base64').toString('utf8')
}

export function buildJobSlug(job: JobSlugSource): string {
  const title = job.title?.trim() || 'job'
  const titleSlug = truncateSlug(slugify(title), 80)

  // Encode the FULL job.id so we can always recover it
  const idToken = base64UrlEncode(job.id)

  return `${titleSlug}-jid-${idToken}`
}

export function buildJobSlugHref(job: JobSlugSource): string {
  return `/job/${buildJobSlug(job)}`
}

/**
 * Parse "[slug]" route param and recover identifiers.
 *
 * Supports:
 *  - v2.7: ...-jid-<base64url(job.id)>
 *  - legacy: ...-job-<raw job.id>  (may contain ":" or %3A)
 */
export function parseJobSlugParam(
  param: string,
): { jobId: string | null; externalId: string | null } {
  const decoded = decodeURIComponent(param)
  const lastSegment = decoded.split('/').pop() || decoded

  // v2.7 pattern: -jid-<token>
  const jid = lastSegment.match(/-jid-([A-Za-z0-9_-]+)$/)
  if (jid && jid[1]) {
    try {
      const jobId = base64UrlDecode(jid[1])
      const externalId = extractExternalId(jobId)
      return { jobId: jobId || null, externalId }
    } catch {
      // fallthrough to legacy parsing
    }
  }

  // legacy pattern: -job-<id>
  const legacy = lastSegment.match(/-job-(.+)$/)
  if (!legacy) return { jobId: null, externalId: null }

  const idPart = legacy[1]
  return {
    jobId: idPart || null,
    externalId: extractExternalId(idPart),
  }
}

function extractExternalId(jobId: string): string | null {
  if (!jobId) return null
  if (!jobId.includes(':')) return null
  const parts = jobId.split(':')
  return parts[parts.length - 1] || null
}
