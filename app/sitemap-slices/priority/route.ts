// app/sitemap-slices/priority/route.ts
// Priority slices: high-signal role salary slices

import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { getSiteUrl } from '../../../lib/seo/site'
import { resolveSliceCanonicalPath } from '../../../lib/seo/canonical'
import type { SliceFilters } from '../../../lib/slices/types'

export const dynamic = 'force-dynamic'
export const revalidate = 86400 // 24h

const SITE_URL = getSiteUrl()
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
      type: 'role-salary',
      jobCount: { gte: 10 },
    },
    orderBy: [{ updatedAt: 'desc' }, { jobCount: 'desc' }],
    take: 10000,
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

    const path = filters
      ? resolveSliceCanonicalPath(filters, slice.slug)
      : `/${slice.slug}`

    if (!path || !path.startsWith('/')) continue

    const loc = escapeXml(`${SITE_URL}${path}`)
    const lastmod = (slice.updatedAt ?? new Date()).toISOString()

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
