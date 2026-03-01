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

  const byLoc = new Map<string, string>()

  for (const slice of slices) {
    const filters: SliceFilters | null = (() => {
      if (!slice.filtersJson) return null
      try {
        return JSON.parse(slice.filtersJson)
      } catch {
        return null
      }
    })()

    const normalizedFilters = normalizeSliceFilters(filters)
    if (!normalizedFilters) continue

    const primaryRole = getPrimaryRole(normalizedFilters)
    if (!primaryRole || !isCanonicalSlug(primaryRole)) continue

    const rawPath = resolveSliceCanonicalPath(normalizedFilters, slice.slug)
    const path = rawPath ? normalizeSlicePath(rawPath) : null

    if (!path || !path.startsWith('/')) continue
    if (SALARY_TIER_PATHS.has(path)) continue

    let liveCount = 0
    try {
      liveCount = await getLiveCount(normalizedFilters)
    } catch (error) {
      console.error(`[sitemap-slices/${shard}] skipping slice due to live count error`, {
        slug: slice.slug,
        error,
      })
      continue
    }

    if (liveCount < threshold) continue

    const loc = `${SITE_URL}${path}`
    const lastmod = (slice.updatedAt ?? new Date()).toISOString()

    const existing = byLoc.get(loc)
    if (!existing || lastmod > existing) {
      byLoc.set(loc, lastmod)
    }

    if (limit && byLoc.size >= limit) {
      break
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
