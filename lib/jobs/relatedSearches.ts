// lib/jobs/relatedSearches.ts
//
// Data for the counted "Related searches" card (listing sidebars, job page rail): other pages a visitor on this one is
// likely to want, each with the number of live jobs THAT page shows. A count is only honest when it is the number on the
// destination, so each link is counted with the destination page's own query (`relatedInput`, one entry per page kind,
// next to each other so a link and its page cannot drift). Counts are cached 5 minutes like the other listing facets.
//
// Thin pages: a link to a page with fewer than RELATED_SEARCH_MIN_JOBS jobs is dropped (those pages are noindex or
// redirect), and a count that cannot be read drops the whole card rather than showing a wrong number.

import { DEFAULT_TTL_MS, memoAsync, stableKey } from '@/lib/cache/memo'
import { buildWhere, type JobQueryInput } from '@/lib/jobs/queryJobs'
import { prisma } from '@/lib/prisma'

export type RelatedSearchInput = Omit<JobQueryInput, 'page' | 'pageSize'>
/** A link to offer. Without `input` it is shown without a count (for example a salary guide, which lists no jobs). */
export type RelatedSearchSpec = { label: string; href: string; input?: RelatedSearchInput }
export type RelatedSearch = { label: string; href: string; count?: number }

export const RELATED_SEARCH_MIN_JOBS = 5
export const RELATED_SEARCH_MAX = 7

/** The query each destination page runs for the total it shows when no filter is applied. */
export const relatedInput = {
  /** /jobs/<role> (RoleTemplate) */
  role: (role: string): RelatedSearchInput => ({ roleSlugs: [role] }),
  /** /remote/<role> */
  remoteRole: (role: string): RelatedSearchInput => ({ roleSlugs: [role], remoteOnly: true }),
  /** /jobs/location/<country> (CountryLocationTemplate) */
  country: (countryCode: string): RelatedSearchInput => ({ countryCode }),
  /** /jobs/city/<city> */
  city: (citySlug: string, countryCode: string): RelatedSearchInput => ({ citySlug, countryCode, isHundredKLocal: true }),
  /** /jobs/<role>/city/<city> */
  roleCity: (role: string, citySlug: string): RelatedSearchInput => ({ roleSlugs: [role], citySlug, isHundredKLocal: true }),
  /** /jobs/skills/<skill> */
  skill: (skillSlug: string): RelatedSearchInput => ({ skillSlugs: [skillSlug], isHundredKLocal: true }),
}

const normalizeHref = (href: string) => href.split(/[?#]/)[0].replace(/\/+$/, '') || '/'

/**
 * Pure: drops counted rows below `minJobs`, orders counted rows biggest first (ties by label) and puts rows with no
 * count last in the order given, then keeps `limit`.
 */
export function rankRelatedSearches(
  rows: RelatedSearch[],
  { limit = RELATED_SEARCH_MAX, minJobs = RELATED_SEARCH_MIN_JOBS } = {},
): RelatedSearch[] {
  const counted = rows
    .filter((r): r is RelatedSearch & { count: number } => r.count !== undefined && r.count >= minJobs)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  const uncounted = rows.filter((r) => r.count === undefined)
  return [...counted, ...uncounted].slice(0, limit)
}

function countFor(input: RelatedSearchInput): Promise<number> {
  return memoAsync(stableKey('related-search-count', input), DEFAULT_TTL_MS, () =>
    prisma.job.count({ where: buildWhere({ ...input, page: 1, pageSize: 1 }) }),
  )
}

/** Counts every spec with its own page's query and returns the card's rows. `exclude` removes the page being viewed. */
export async function loadRelatedSearches(
  specs: RelatedSearchSpec[],
  options: { exclude?: string[]; limit?: number; minJobs?: number } = {},
): Promise<RelatedSearch[]> {
  const seen = new Set((options.exclude ?? []).map(normalizeHref))
  const unique = specs.filter((s) => {
    const key = normalizeHref(s.href)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  try {
    const rows = await Promise.all(
      unique.map(async (s): Promise<RelatedSearch> => ({
        label: s.label,
        href: s.href,
        ...(s.input ? { count: await countFor(s.input) } : {}),
      })),
    )
    return rankRelatedSearches(rows, { limit: options.limit, minJobs: options.minJobs })
  } catch {
    return []
  }
}
