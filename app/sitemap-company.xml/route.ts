// app/sitemap-company.xml/route.ts
// Sitemap index for /company/[slug] pages (sharded)

import { prisma } from '../../lib/prisma'
import { buildFallbackUrlsetResponse } from '../../lib/seo/fallbackSitemap'
import { getSiteUrl } from '../../lib/seo/site'
import { MIN_COMPANY_INDEXABLE_JOBS } from '../../lib/seo/indexabilityGates'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { getMaxCompanySitemapPages } from '../../lib/seo/sitemapPolicy'

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

async function fetchEligibleCompanyCount(): Promise<number> {
  const eligibleJobWhere = buildWhere({})
  const rows = await prisma.company.findMany({
    where: {
      jobs: {
        some: eligibleJobWhere,
      },
    },
    select: {
      id: true,
      jobs: {
        where: eligibleJobWhere,
        select: {
          id: true,
        },
        take: MIN_INDEXABLE_JOBS,
      },
    },
  })

  return rows.filter((row) => row.jobs.length >= MIN_INDEXABLE_JOBS).length
}

export async function GET() {
  try {
    const total = await fetchEligibleCompanyCount()
    const totalPages = Math.min(
      Math.ceil(total / PAGE_SIZE),
      getMaxCompanySitemapPages(),
    )

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
  } catch (error) {
    return buildFallbackUrlsetResponse('sitemap-company', [], error)
  }
}
