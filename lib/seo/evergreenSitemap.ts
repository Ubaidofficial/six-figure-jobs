// Evergreen sitemap entries: pillar hubs, the Phase 1 role pages, salary guides, remote role pages and the blog.
//
// A sitemap should list exactly the pages that are indexable and canonical. Each page type below applies the SAME
// rule its own generateMetadata() uses, so a URL is advertised if and only if the page serves `index, follow`:
//   /jobs/<role>    isTier1Role && >= 3 live jobs && isPhaseIndexable            (app/jobs/[role]/page.tsx)
//   /salary/<role>  >= 1 live $100k+ posting                                     (app/salary/[role]/page.tsx)
//   /remote/<role>  isTier1Role && isRemoteRolePageIndexable && isPhaseIndexable (app/remote/[role]/page.tsx)
// `lastmod` is the newest job update behind the page (not the request time), so it only moves when content does.

import { prisma } from '../prisma'
import { BLOG_POSTS } from '../blog/posts'
import { buildGlobalExclusionsWhere, buildHighSalaryEligibilityWhere, buildWhere } from '../jobs/queryJobs'
import { isTier1Role } from '../roles/canonicalSlugs'
import { isRemoteRolePageIndexable } from './indexabilityGates'
import { PHASE_1_ROLE_SLUGS, isPhaseIndexable } from './indexingPhase'
import { shouldAdvertiseSitemapFamily } from './sitemapPolicy'

export type SitemapEntry = { path: string; lastmod: Date | null }

const PILLAR_PATHS = ['/', '/jobs', '/salary', '/companies', '/remote']
const MIN_ROLE_PAGE_JOBS = 3
const CACHE_TTL_MS = 60 * 60 * 1000

let cache: { at: number; entries: SitemapEntry[] } | null = null

/** Newest update among live jobs; null when the database cannot be reached (callers then omit `lastmod`). */
export async function getLatestJobUpdate(): Promise<Date | null> {
  try {
    const agg = await prisma.job.aggregate({ where: { isExpired: false }, _max: { updatedAt: true } })
    return agg._max.updatedAt ?? null
  } catch {
    return null
  }
}

export function getLatestBlogUpdate(): Date | null {
  const times = BLOG_POSTS.map((p) => new Date(p.updatedAt || p.publishedAt).getTime()).filter(Number.isFinite)
  return times.length ? new Date(Math.max(...times)) : null
}

async function countAndLatest(where: object): Promise<{ count: number; latest: Date | null }> {
  const agg = await prisma.job.aggregate({ where, _count: { _all: true }, _max: { updatedAt: true } })
  return { count: agg._count._all, latest: agg._max.updatedAt ?? null }
}

async function collectRoleEntries(role: string): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = []
  const tier1 = isTier1Role(role)

  const [jobs, salary, remote] = await Promise.all([
    countAndLatest(buildWhere({ roleSlugs: [role], page: 1, pageSize: 1 })),
    countAndLatest({
      isExpired: false,
      roleSlug: role,
      AND: [
        buildHighSalaryEligibilityWhere(),
        buildGlobalExclusionsWhere(),
        { OR: [{ maxAnnual: { gte: BigInt(100_000) } }, { minAnnual: { gte: BigInt(100_000) } }] },
      ],
    }),
    countAndLatest(buildWhere({ roleSlugs: [role], remoteOnly: true, page: 1, pageSize: 1 })),
  ])

  if (tier1 && jobs.count >= MIN_ROLE_PAGE_JOBS && isPhaseIndexable({ roleSlug: role, pathname: `/jobs/${role}` })) {
    entries.push({ path: `/jobs/${role}`, lastmod: jobs.latest })
  }
  if (salary.count >= 1) {
    entries.push({ path: `/salary/${role}`, lastmod: salary.latest })
  }
  // When the dedicated remote family is advertised (phase 2+) it owns these URLs; avoid listing them twice.
  if (
    !shouldAdvertiseSitemapFamily('remote') &&
    tier1 &&
    isRemoteRolePageIndexable(remote.count) &&
    isPhaseIndexable({ roleSlug: role, pathname: `/remote/${role}` })
  ) {
    entries.push({ path: `/remote/${role}`, lastmod: remote.latest })
  }
  return entries
}

export async function collectEvergreenEntries(now: number = Date.now()): Promise<SitemapEntry[]> {
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.entries

  const latestJob = await getLatestJobUpdate()
  const entries: SitemapEntry[] = PILLAR_PATHS.map((path) => ({ path, lastmod: latestJob }))

  if (BLOG_POSTS.length > 0 && !shouldAdvertiseSitemapFamily('blog')) {
    entries.push({ path: '/blog', lastmod: getLatestBlogUpdate() })
    for (const post of BLOG_POSTS) {
      entries.push({ path: `/blog/${post.slug}`, lastmod: new Date(post.updatedAt || post.publishedAt) })
    }
  }

  let roleEntries: SitemapEntry[] = []
  let complete = latestJob !== null
  if (complete) {
    try {
      roleEntries = (await Promise.all([...PHASE_1_ROLE_SLUGS].map(collectRoleEntries))).flat()
    } catch {
      complete = false
    }
  }
  const result = [...entries, ...roleEntries]

  // Only cache a complete result; a database blip must not freeze a thin sitemap for an hour.
  if (complete) cache = { at: now, entries: result }
  return result
}

export function __resetEvergreenSitemapCacheForTests() {
  cache = null
}
