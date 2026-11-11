// lib/jobs/publicJob.ts
//
// What a job looks like once it leaves the server. Internal ids name where we found a job ("board:<source>:<ref>") and
// `source` names the feed, and both were serialized into every page that showed the job (React props and keys in the
// page's RSC payload, the apply/save/report buttons, the "load more" APIs). The owner does not want sources named on
// the site (2026-11-11), so client components get the job's public id instead: the short code at the end of its URL
// ("…-j-1a2b3c4d", which is also Job.shortId), with the URL itself precomputed, and no source fields.
import { buildJobSlugHref, getShortStableIdForJobId } from './jobSlug'

/** The id the browser sees: the code at the end of the job's URL. The API routes look jobs up by it (Job.shortId). */
export function publicJobId(id: string): string {
  return getShortStableIdForJobId(id)
}

/** Fields that say where a job came from; never sent to the browser. */
const SOURCE_FIELDS = ['source', 'sourceRef', 'externalId', 'dedupeKey', 'sourcePriority'] as const

/**
 * A job for a client component: `id` is the public id, `href` the job's URL (built from the real id, so links do not
 * change), and the source fields are removed.
 */
export function toPublicJob<T extends { id: string; title?: string | null }>(job: T): T & { href: string } {
  const out: Record<string, unknown> = { ...job, id: publicJobId(job.id), href: buildJobSlugHref(job as any) }
  for (const field of SOURCE_FIELDS) delete out[field]
  return out as T & { href: string }
}

/**
 * Prisma filter for a job id sent back by the browser: the public id (Job.shortId, the code in the job's URL) or, from
 * pages rendered before ids were made public, the internal id. Use with findFirst.
 */
export function jobByClientId(ref: string) {
  return { OR: [{ shortId: ref }, { id: ref }] }
}
