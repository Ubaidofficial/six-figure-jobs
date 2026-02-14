// app/sitemap-slices/longtail/route.ts
// Longtail slices: modest job counts, exclude very thin pages

import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { getSiteUrl } from '../../../lib/seo/site'
import { resolveSliceCanonicalPath } from '../../../lib/seo/canonical'
import type { SliceFilters } from '../../../lib/slices/types'
import { buildWhere } from '../../../lib/jobs/queryJobs'
import { isCanonicalSlug } from '../../../lib/roles/canonicalSlugs'

export const dynamic = 'force-dynamic'
export const revalidate = 86400 // 24h

const SITE_URL = getSiteUrl()
const SALARY_TIER_PATHS = new Set([
  '/jobs/100k-plus',
  '/jobs/200k-plus',
  '/jobs/300k-plus',
  '/jobs/400k-plus',
])

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

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const slices = await prisma.jobSlice.findMany({
    select: {
      slug: true,
      updatedAt: true,
      jobCount: true,
      filtersJson: true,
    },
    where: {
      jobCount: { gte: 5, lt: 20 },
      NOT: {
        type: 'role-salary',
        jobCount: { gte: 10 },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { jobCount: 'desc' }],
    take: 10000,
  })

  const byLoc = new Map<string, string>()

  for (const s of slices) {
      const filters: SliceFilters | null = (() => {
        if (!s.filtersJson) return null
        try {
          return JSON.parse(s.filtersJson)
        } catch {
          return null
        }
      })()

      const normalizedFilters = normalizeSliceFilters(filters)

      // Hard requirement: sitemap must only contain canonical URLs.
      // If filters are missing/corrupt, skip instead of falling back to raw DB slug.
      if (!normalizedFilters) continue

      const primaryRole = getPrimaryRole(normalizedFilters)
      // Prevent country-only/invalid role paths from resolving to soft-404 /jobs/[role]/[filter].
      if (!primaryRole || !isCanonicalSlug(primaryRole)) continue

      const rawPath = resolveSliceCanonicalPath(normalizedFilters, s.slug)

      const path = rawPath ? normalizeSlicePath(rawPath) : null

      if (!path || !path.startsWith('/')) continue
      if (SALARY_TIER_PATHS.has(path)) continue

      let liveCount = 0
      try {
        liveCount = await getLiveCount(normalizedFilters)
      } catch (error) {
        console.error('[sitemap-slices/longtail] skipping slice due to live count error', {
          slug: s.slug,
          error,
        })
        continue
      }

      // Keep only pages that still meet the indexability threshold.
      if (liveCount < 5) continue

      const loc = escapeXml(`${SITE_URL}${path}`)
      const lastmod = (s.updatedAt ?? new Date()).toISOString()

      const existing = byLoc.get(loc)
      if (!existing || lastmod > existing) {
        byLoc.set(loc, lastmod)
      }
    }

  const urls = Array.from(byLoc.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([loc, lastmod]) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
    )

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
