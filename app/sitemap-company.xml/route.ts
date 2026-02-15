// app/sitemap-company.xml/route.ts
// Sitemap index for /company/[slug] pages (sharded)

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getSiteUrl } from '../../lib/seo/site'
import { MIN_COMPANY_INDEXABLE_JOBS } from '../../lib/seo/indexabilityGates'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 45000
const MIN_INDEXABLE_JOBS = MIN_COMPANY_INDEXABLE_JOBS

export const dynamic = 'force-dynamic'
export const revalidate = 43200 // 24h

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toNumber(value: unknown): number {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

async function fetchEligibleCompanyCount(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT 1
      FROM "Job"
      WHERE "isExpired" = false AND "companyId" IS NOT NULL
      GROUP BY "companyId"
      HAVING COUNT(*) >= ${MIN_INDEXABLE_JOBS}
    ) t
  `)

  const raw = rows[0]?.count ?? 0
  return toNumber(raw)
}

export async function GET() {
  const total = await fetchEligibleCompanyCount()
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const lastmod = new Date().toISOString()

  const entries = Array.from({ length: totalPages }).map((_, i) => {
    const loc = escapeXml(`${SITE_URL}/sitemap-company/${i + 1}`)
    return `  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`

  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
