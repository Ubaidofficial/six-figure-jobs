// Evergreen sitemap entries: pillar hubs, the Phase 1 role pages, salary guides, remote role pages, the blog and the
// pSEO pages unlocked by job count (skill / city / level hubs, senior-style role pages, role x skill / city combos).
//
// A sitemap should list exactly the pages that are indexable and canonical. Each page type below applies the SAME
// rule its own generateMetadata() uses, so a URL is advertised if and only if the page serves `index, follow`:
//   /jobs/<role>    isTier1Role && >= 3 live jobs && isPhaseIndexable            (app/jobs/[role]/page.tsx)
//   /salary/<role>  >= 1 live $100k+ posting                                     (app/salary/[role]/page.tsx)
//   /remote/<role>  isTier1Role && isRemoteRolePageIndexable && isPhaseIndexable (app/remote/[role]/page.tsx)
//   pSEO hubs       count >= PSEO hub / role threshold (lib/seo/pseoUnlock.ts), same counts as their pages
// `lastmod` is the newest job update behind the page (not the request time), so it only moves when content does.

import { prisma } from '../prisma'
import { BLOG_POSTS } from '../blog/posts'
import { buildGlobalExclusionsWhere, buildHighSalaryEligibilityWhere, buildWhere } from '../jobs/queryJobs'
import { getTier1Slugs, isTier1Role } from '../roles/canonicalSlugs'
import { isCityPageIndexable, isRemoteRolePageIndexable } from './indexabilityGates'
import { PHASE_1_ROLE_SLUGS, isPhaseIndexable, isPhase2OrLater } from './indexingPhase'
import { CITY_TARGETS, LEVEL_TARGETS, SKILL_TARGETS } from './pseoTargets'
import {
  PSEO_COMBO_SITEMAP_MIN_JOBS,
  isPseoHubUnlocked,
  isPseoRoleUnlocked,
  isPseoUnlockEnabled,
} from './pseoUnlock'
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

/** Runs `fn` over `items` with at most `limit` in flight, keeping result order. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

const QUERY_CONCURRENCY = 6

/**
 * pSEO pages that clear their job-count threshold while Phase 1 still silences their sitemap family.
 * Every count uses the same buildWhere() input as the page, so the sitemap and the page's robots tag agree.
 * In phase 2+ the dedicated families (skills / city / level / browse) own these URLs, so nothing is listed twice.
 */
async function collectPseoEntries(): Promise<SitemapEntry[]> {
  if (!isPseoUnlockEnabled()) return []
  const entries: SitemapEntry[] = []
  const listSkills = !shouldAdvertiseSitemapFamily('skills')
  const listCities = !shouldAdvertiseSitemapFamily('city')
  const listLevels = !shouldAdvertiseSitemapFamily('level')
  const listRolesAndCombos = !isPhase2OrLater()

  const unlockedSkills: string[] = []
  const unlockedCities: Array<{ slug: string; countryCode?: string }> = []

  if (listSkills || listRolesAndCombos) {
    const counts = await mapLimit(SKILL_TARGETS, QUERY_CONCURRENCY, (skill) =>
      countAndLatest(buildWhere({ skillSlugs: [skill.slug], isHundredKLocal: true, page: 1, pageSize: 1 })),
    )
    SKILL_TARGETS.forEach((skill, i) => {
      if (counts[i].count >= 5 && isPseoHubUnlocked(counts[i].count)) {
        unlockedSkills.push(skill.slug)
        if (listSkills) entries.push({ path: `/jobs/skills/${skill.slug}`, lastmod: counts[i].latest })
      }
    })
  }

  if (listCities || listRolesAndCombos) {
    const counts = await mapLimit(CITY_TARGETS, QUERY_CONCURRENCY, (city) =>
      countAndLatest(
        buildWhere({ citySlug: city.slug, countryCode: city.countryCode, isHundredKLocal: true, page: 1, pageSize: 1 }),
      ),
    )
    CITY_TARGETS.forEach((city, i) => {
      if (isCityPageIndexable(counts[i].count) && isPseoHubUnlocked(counts[i].count)) {
        unlockedCities.push({ slug: city.slug, countryCode: city.countryCode })
        if (listCities) entries.push({ path: `/jobs/city/${city.slug}`, lastmod: counts[i].latest })
      }
    })
  }

  if (listLevels) {
    const levels = Object.keys(LEVEL_TARGETS)
    const counts = await mapLimit(levels, QUERY_CONCURRENCY, (level) =>
      countAndLatest(buildWhere({ experienceLevel: level, isHundredKLocal: true, page: 1, pageSize: 1 })),
    )
    levels.forEach((level, i) => {
      if (counts[i].count >= 5 && isPseoHubUnlocked(counts[i].count)) {
        entries.push({ path: `/jobs/level/${level}`, lastmod: counts[i].latest })
      }
    })
  }

  if (listRolesAndCombos) {
    // One grouped query gives every role's count: /jobs/<role> matches roleSlug equal to OR containing the role.
    const groups = await prisma.job.groupBy({
      by: ['roleSlug'],
      where: buildWhere({ page: 1, pageSize: 1 }),
      _count: { _all: true },
      _max: { updatedAt: true },
    })
    for (const role of getTier1Slugs()) {
      if (PHASE_1_ROLE_SLUGS.has(role)) continue // already listed by collectRoleEntries
      let count = 0
      let latest: Date | null = null
      for (const g of groups) {
        if (!g.roleSlug || !g.roleSlug.includes(role)) continue
        count += g._count._all
        const at = g._max.updatedAt
        if (at && (!latest || at > latest)) latest = at
      }
      if (count >= 3 && isPseoRoleUnlocked(count)) entries.push({ path: `/jobs/${role}`, lastmod: latest })
    }

    // Role x skill and role x city combos for the Phase 1 roles, limited to unlocked skills / cities.
    const combos: Array<{ path: string; input: Parameters<typeof buildWhere>[0] }> = []
    for (const role of PHASE_1_ROLE_SLUGS) {
      for (const skill of unlockedSkills) {
        combos.push({
          path: `/jobs/${role}/skills/${skill}`,
          input: { roleSlugs: [role], skillSlugs: [skill], isHundredKLocal: true, page: 1, pageSize: 1 },
        })
      }
      for (const city of unlockedCities) {
        combos.push({
          path: `/jobs/${role}/city/${city.slug}`,
          input: { roleSlugs: [role], citySlug: city.slug, isHundredKLocal: true, page: 1, pageSize: 1 },
        })
      }
    }
    const counts = await mapLimit(combos, QUERY_CONCURRENCY, (c) => countAndLatest(buildWhere(c.input)))
    combos.forEach((c, i) => {
      if (counts[i].count >= PSEO_COMBO_SITEMAP_MIN_JOBS) entries.push({ path: c.path, lastmod: counts[i].latest })
    })
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
  let pseoEntries: SitemapEntry[] = []
  let complete = latestJob !== null
  if (complete) {
    try {
      roleEntries = (await Promise.all([...PHASE_1_ROLE_SLUGS].map(collectRoleEntries))).flat()
      pseoEntries = await collectPseoEntries()
    } catch {
      complete = false
    }
  }
  const result = [...entries, ...roleEntries, ...pseoEntries]

  // Only cache a complete result; a database blip must not freeze a thin sitemap for an hour.
  if (complete) cache = { at: now, entries: result }
  return result
}

export function __resetEvergreenSitemapCacheForTests() {
  cache = null
}
