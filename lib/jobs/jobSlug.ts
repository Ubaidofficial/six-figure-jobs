// lib/jobs/jobSlug.ts
/**
 * Canonical pattern (v2.8):
 *   /job/<short-title-slug>-j-<shortStableId>
 *
 * Goals:
 * - SEO: slug is based on job title only (no company)
 * - Short: keep slug short (max words, max len)
 * - Stable: suffix derived from job.id (stable hash)
 * - Backwards compatible:
 *   - v2.7: ...-jid-<base64url(job.id)>
 *   - legacy: ...-job-<raw job.id>
 *   - raw id: /job/<raw job.id> (e.g. ats:greenhouse:824...)
 */
export type JobSlugSource = {
  id: string
  title?: string | null
  // NOTE: roleSlug is a ROLE/category slug in your codebase; do NOT use it for job hrefs.
  roleSlug?: string | null
  externalId?: string | null
  source?: string | null
}

const MAX_WORDS = 7
const MAX_LEN = 70

function slugify(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[@#]/g, ' ')
    .replace(/\([^)]*\)/g, ' ') // remove (Starlink), (Level 4/5)
    .replace(/\[[^\]]*\]/g, ' ') // remove [Hiring]
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function truncateByWords(slug: string, maxWords: number): string {
  const parts = slug.split('-').filter(Boolean)
  return parts.slice(0, maxWords).join('-')
}

function truncateLen(slug: string, maxLen = MAX_LEN): string {
  if (slug.length <= maxLen) return slug
  const cut = slug.slice(0, maxLen)
  const lastDash = cut.lastIndexOf('-')
  return (lastDash > 25 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '')
}

/**
 * Stable short suffix from job.id (FNV-1a 32-bit) -> base36
 * Not reversible, but stable and short.
 * (We still support decoding old -jid- tokens for backwards compatibility.)
 */
function shortStableId(id: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  // Slightly longer than 6 to reduce collision risk
  return h.toString(36).slice(0, 8)
}

/**
 * Base64url decode (URL-safe base64 without padding)
 * Only used for parsing legacy v2.7 `-jid-<token>` URLs.
 */
function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  return Buffer.from(b64 + pad, 'base64').toString('utf8')
}

export function buildJobSlug(job: JobSlugSource): string {
  const title = job.title?.trim() || 'job'
  let titleSlug = slugify(title)
  titleSlug = truncateByWords(titleSlug, MAX_WORDS)
  titleSlug = truncateLen(titleSlug, MAX_LEN)

  const suffix = shortStableId(job.id)
  return `${titleSlug || 'job'}-j-${suffix}`
}

export function buildJobSlugHref(job: JobSlugSource): string {
  return `/job/${buildJobSlug(job)}`
}

export type ParsedJobSlug = {
  roleSlug: string | null
  jobId: string | null
  externalId: string | null
  shortId: string | null
}

/**
 * Parse "[slug]" route param and recover identifiers.
 *
 * Supports:
 *  - v2.8: <title>-j-<short>               => shortId (for DB lookup once backfilled)
 *  - v2.7: ...-jid-<base64url(job.id)>     => jobId (decoded)
 *  - legacy: ...-job-<raw job.id>          => jobId (raw)
 *  - raw: <raw job.id> (contains ":")      => jobId (raw)
 */
export function parseJobSlugParam(param: string): ParsedJobSlug {
  const decoded = decodeURIComponent(param || '')
  const lastSegment = decoded.split('/').pop() || decoded

  // v2.7: -jid-<token> (reversible)
  const jid = lastSegment.match(/-jid-([A-Za-z0-9_-]+)$/)
  if (jid?.[1]) {
    try {
      const jobId = base64UrlDecode(jid[1])
      return {
        roleSlug: null,
        jobId: jobId || null,
        externalId: jobId ? extractExternalId(jobId) : null,
        shortId: null,
      }
    } catch {
      // fallthrough
    }
  }

  // legacy: -job-<raw id>
  const legacy = lastSegment.match(/-job-(.+)$/)
  if (legacy?.[1]) {
    const jobId = legacy[1]
    return { roleSlug: null, jobId, externalId: extractExternalId(jobId), shortId: null }
  }

  // raw id as entire slug (e.g. ats:greenhouse:824...)
  if (lastSegment.includes(':')) {
    const jobId = lastSegment
    return { roleSlug: null, jobId, externalId: extractExternalId(jobId), shortId: null }
  }

  // v2.8: ...-j-<shortStableId>
  const v28 = lastSegment.match(/-j-([a-z0-9]{5,12})$/)
  if (v28?.[1]) {
    return { roleSlug: lastSegment || null, jobId: null, externalId: null, shortId: v28[1] }
  }

  // otherwise treat as opaque slug
  return { roleSlug: lastSegment || null, jobId: null, externalId: null, shortId: null }
}

function extractExternalId(jobId: string): string | null {
  if (!jobId) return null
  if (!jobId.includes(':')) return null
  const parts = jobId.split(':')
  return parts[parts.length - 1] || null
}

export function getShortStableIdForJobId(id: string): string {
  return shortStableId(id)
}
