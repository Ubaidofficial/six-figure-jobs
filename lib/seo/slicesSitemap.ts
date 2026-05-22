import { prisma } from '../prisma'
import { getSiteUrl } from './site'
import { resolveSliceCanonicalPath } from './canonical'
import type { SliceFilters } from '../slices/types'
import { buildWhere } from '../jobs/queryJobs'
import { isCanonicalSlug } from '../roles/canonicalSlugs'

const SITE_URL = getSiteUrl()
const MAX_SLICES = 10000

const SALARY_TIER_PATHS = new Set([
  '/jobs/100k-plus',
  '/jobs/200k-plus',
  '/jobs/300k-plus',
  '/jobs/400k-plus',
])

export type SliceShard = 'priority' | 'longtail'

export type SliceSitemapEntry = {
  loc: string
  lastmod: string
}

type SliceCandidate = {
  slug: string
  path: string
  updatedAt: Date | null
  filters: SliceFilters
}

type SliceRow = {
  slug: string
  updatedAt: Date | null
  filtersJson: string | null
}

function normalizeSlicePath(pathOrSlug: string): string | null {
  const raw = pathOrSlug.startsWith('/') ? pathOrSlug : `/${pathOrSlug}`
  const parts = raw
    .split('/')
    .filter(Boolean)
    .map((p) => p.trim().toLowerCase())
  if (parts.length === 0) return null
  return '/' + parts.join('/')
}

function normalizeSliceFilters(filters: SliceFilters | null): SliceFilters | null {
  if (!filters) return null
  const next: any = { ...filters }
  if (!Array.isArray(next.roleSlugs) && typeof next.roleSlug === 'string') {
    next.roleSlugs = [next.roleSlug]
  }
  return next as SliceFilters
}

function getPrimaryRole(filters: SliceFilters): string | null {
  const first = filters.roleSlugs?.[0]
  if (!first) return null
  const role = String(first).trim().toLowerCase()
  return role || null
}

function getLiveCountThreshold(shard: SliceShard): number {
  return shard === 'priority' ? 10 : 5
}

function buildSliceQueryWhere(shard: SliceShard) {
  if (shard === 'priority') {
    return {
      type: 'role-salary',
      jobCount: { gte: 10 },
    } as const
  }

  return {
    jobCount: { gte: 5, lt: 20 },
    NOT: {
      type: 'role-salary',
      jobCount: { gte: 10 },
    },
  } as const
}

async function getLiveCount(filters: SliceFilters): Promise<number> {
  const where = buildWhere({
    roleSlugs: filters.roleSlugs,
    countryCode: filters.countryCode,
    citySlug: filters.citySlug,
    minAnnual: filters.minAnnual,
    remoteOnly: filters.remoteOnly,
    remoteMode: filters.remoteMode,
    remoteRegion: filters.remoteRegion,
    isHundredKLocal: filters.isHundredKLocal,
    page: 1,
    pageSize: 1,
  })
  return prisma.job.count({ where })
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const current = index++
      results[current] = await mapper(items[current])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

function buildCandidateFromSlice(slice: SliceRow): SliceCandidate | null {
  const filters: SliceFilters | null = (() => {
    if (!slice.filtersJson) return null
    try {
      return JSON.parse(slice.filtersJson)
    } catch {
      return null
    }
  })()

  const normalizedFilters = normalizeSliceFilters(filters)
  if (!normalizedFilters) return null

  const primaryRole = getPrimaryRole(normalizedFilters)
  if (!primaryRole || !isCanonicalSlug(primaryRole)) return null

  const rawPath = resolveSliceCanonicalPath(normalizedFilters, slice.slug)
  const path = rawPath ? normalizeSlicePath(rawPath) : null

  if (!path || !path.startsWith('/')) return null
  if (SALARY_TIER_PATHS.has(path)) return null

  return {
    slug: slice.slug,
    path,
    updatedAt: slice.updatedAt,
    filters: normalizedFilters,
  }
}

async function getPriorityOwnedLocs(): Promise<Set<string>> {
  const slices = await prisma.jobSlice.findMany({
    select: {
      slug: true,
      updatedAt: true,
      filtersJson: true,
    },
    where: buildSliceQueryWhere('priority'),
    orderBy: [{ updatedAt: 'desc' }, { jobCount: 'desc' }],
    take: MAX_SLICES,
  })

  const locs = new Set<string>()
  for (const slice of slices) {
    const candidate = buildCandidateFromSlice(slice)
    if (candidate) locs.add(`${SITE_URL}${candidate.path}`)
  }
  return locs
}

export async function buildSliceSitemapEntries(
  shard: SliceShard,
  options?: { limit?: number },
): Promise<SliceSitemapEntry[]> {
  const threshold = getLiveCountThreshold(shard)
  const limit = options?.limit ? Math.max(1, Math.floor(options.limit)) : null

  const slices = await prisma.jobSlice.findMany({
    select: {
      slug: true,
      updatedAt: true,
      jobCount: true,
      filtersJson: true,
    },
    where: buildSliceQueryWhere(shard),
    orderBy: [{ updatedAt: 'desc' }, { jobCount: 'desc' }],
    take: MAX_SLICES,
  })

  let candidates: SliceCandidate[] = []

  for (const slice of slices) {
    const candidate = buildCandidateFromSlice(slice)
    if (candidate) candidates.push(candidate)
  }

  if (shard === 'longtail' && candidates.length > 0) {
    const priorityOwnedLocs = await getPriorityOwnedLocs()
    candidates = candidates.filter((candidate) => !priorityOwnedLocs.has(`${SITE_URL}${candidate.path}`))
  }

  const byLoc = new Map<string, string>()

  function addCandidate(candidate: SliceCandidate, liveCount: number) {
    if (liveCount < threshold) return false

    const loc = `${SITE_URL}${candidate.path}`
    const lastmod = (candidate.updatedAt ?? new Date()).toISOString()
    const existing = byLoc.get(loc)
    if (!existing || lastmod > existing) {
      byLoc.set(loc, lastmod)
    }

    if (limit && byLoc.size >= limit) {
      return true
    }

    return false
  }

  if (limit) {
    for (const candidate of candidates) {
      try {
        if (addCandidate(candidate, await getLiveCount(candidate.filters))) break
      } catch (error) {
        console.error(`[sitemap-slices/${shard}] skipping slice due to live count error`, {
          slug: candidate.slug,
          error,
        })
      }
    }
  } else {
    const checked = await mapWithConcurrency(candidates, 8, async (candidate) => {
      try {
        return {
          candidate,
          liveCount: await getLiveCount(candidate.filters),
        }
      } catch (error) {
        console.error(`[sitemap-slices/${shard}] skipping slice due to live count error`, {
          slug: candidate.slug,
          error,
        })
        return { candidate, liveCount: 0 }
      }
    })

    for (const { candidate, liveCount } of checked) {
      addCandidate(candidate, liveCount)
    }
  }

  return Array.from(byLoc.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([loc, lastmod]) => ({ loc, lastmod }))
}

export async function hasSliceSitemapEntries(): Promise<boolean> {
  const [priority, longtail] = await Promise.all([
    buildSliceSitemapEntries('priority', { limit: 1 }),
    buildSliceSitemapEntries('longtail', { limit: 1 }),
  ])

  return priority.length > 0 || longtail.length > 0
}
