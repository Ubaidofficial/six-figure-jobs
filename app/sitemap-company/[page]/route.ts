// app/sitemap-company/[page]/route.ts
// Sharded company sitemap pages

import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma'
import { getSiteUrl } from '../../../lib/seo/site'
import { MIN_COMPANY_INDEXABLE_JOBS } from '../../../lib/seo/indexabilityGates'

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

function toMs(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' || typeof value === 'number') {
    const n = new Date(value).getTime()
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

type CompanyRow = {
  companyId: string
  slug: string
  companyUpdatedAt: Date
  maxUpdatedAt: Date
}

async function fetchCompanyPage(page: number): Promise<CompanyRow[]> {
  const offset = (page - 1) * PAGE_SIZE
  return prisma.$queryRaw<CompanyRow[]>(Prisma.sql`
    SELECT
      c.id AS "companyId",
      c.slug AS "slug",
      c."updatedAt" AS "companyUpdatedAt",
      j."maxUpdatedAt" AS "maxUpdatedAt"
    FROM (
      SELECT "companyId", MAX("updatedAt") AS "maxUpdatedAt", COUNT(*) AS "jobCount"
      FROM "Job"
      WHERE "isExpired" = false AND "companyId" IS NOT NULL
      GROUP BY "companyId"
      HAVING COUNT(*) >= ${MIN_INDEXABLE_JOBS}
    ) j
    JOIN "Company" c ON c.id = j."companyId"
    ORDER BY j."maxUpdatedAt" DESC, c.id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `)
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ page: string }> },
) {
  const params = await ctx.params
  const page = Number(params.page || '1')

  if (!Number.isFinite(page) || page < 1) {
    return new Response('Not found', { status: 404 })
  }

  const rows = await fetchCompanyPage(page)

  if (rows.length === 0) {
    if (page === 1) {
      const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`

      return new Response(emptyXml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      })
    }

    return new Response('Not found', { status: 404 })
  }

  const urls = rows.map((row) => {
    const loc = escapeXml(`${SITE_URL}/company/${row.slug}`)
    const lastmod = new Date(
      Math.max(toMs(row.maxUpdatedAt), toMs(row.companyUpdatedAt)),
    ).toISOString()

    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
