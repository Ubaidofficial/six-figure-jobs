// app/sitemap-slices/priority/route.ts
// Priority slices: higher job counts or recently updated

import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { getSiteUrl } from '../../../lib/seo/site'
import { resolveSliceCanonicalPath } from '../../../lib/seo/canonical'
import type { SliceFilters } from '../../../lib/slices/types'

export const dynamic = 'force-static'
export const revalidate = 86400 // 24h

const SITE_URL = getSiteUrl()
const RECENT_DAYS = 7

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS)

  const slices = await prisma.jobSlice.findMany({
    select: {
      slug: true,
      updatedAt: true,
      jobCount: true,
      filtersJson: true,
    },
    where: {
      jobCount: { gt: 0 },
      OR: [{ jobCount: { gte: 20 } }, { updatedAt: { gte: cutoff } }],
    },
    orderBy: [{ updatedAt: 'desc' }, { jobCount: 'desc' }],
    take: 10000,
  })

  const urls = slices
    .map((s) => {
      const filters: SliceFilters | null = (() => {
        if (!s.filtersJson) return null
        try {
          return JSON.parse(s.filtersJson)
        } catch {
          return null
        }
      })()

      const path = filters
        ? resolveSliceCanonicalPath(filters, s.slug)
        : `/${s.slug}`

      if (!path || !path.startsWith('/')) return null

      const loc = escapeXml(`${SITE_URL}${path}`)
      const lastmod = (s.updatedAt ?? new Date()).toISOString()

      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
    })
    .filter(Boolean) as string[]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
