// app/sitemap-company/[page]/route.ts
// Sharded company sitemap pages

import { prisma } from '../../../lib/prisma'
import { getSiteUrl } from '../../../lib/seo/site'
import { MIN_COMPANY_INDEXABLE_JOBS } from '../../../lib/seo/indexabilityGates'
import { buildWhere } from '../../../lib/jobs/queryJobs'
import {
  getMaxCompanySitemapPages,
  getMaxCompanyUrlsPerPage,
} from '../../../lib/seo/sitemapPolicy'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../../lib/seo/sitemapResponseMeta'

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
  slug: string
  companyUpdatedAt: Date
  latestJobUpdatedAt: Date | null
}

async function fetchCompanyPage(page: number): Promise<CompanyRow[]> {
  const offset = (page - 1) * PAGE_SIZE
  const eligibleJobWhere = buildWhere({})

  return prisma.company.findMany({
    where: {
      jobs: {
        some: eligibleJobWhere,
      },
    },
    select: {
      slug: true,
      updatedAt: true,
      jobs: {
        where: eligibleJobWhere,
        select: {
          updatedAt: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: MIN_INDEXABLE_JOBS,
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    skip: offset,
    take: PAGE_SIZE,
  }).then((rows) =>
    rows
      .filter((row) => row.jobs.length >= MIN_INDEXABLE_JOBS)
      .map((row) => ({
        slug: row.slug,
        companyUpdatedAt: row.updatedAt,
        latestJobUpdatedAt: row.jobs[0]?.updatedAt ?? null,
      })),
  )
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
  if (page > getMaxCompanySitemapPages()) {
    return new Response('Not found', { status: 404 })
  }

  const rows = (await fetchCompanyPage(page)).slice(0, getMaxCompanyUrlsPerPage())

  if (rows.length === 0) {
    if (page === 1) {
      const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${buildSitemapMetaComment('sitemap-company-page')}
</urlset>`

      return new Response(emptyXml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          ...buildSitemapMetaHeaders('sitemap-company-page'),
        },
      })
    }

    return new Response('Not found', { status: 404 })
  }

  const urls = rows.map((row) => {
    const loc = escapeXml(`${SITE_URL}/company/${row.slug}`)
    const lastmod = new Date(
      Math.max(toMs(row.latestJobUpdatedAt), toMs(row.companyUpdatedAt)),
    ).toISOString()

    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
  ${buildSitemapMetaComment('sitemap-company-page')}
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...buildSitemapMetaHeaders('sitemap-company-page'),
    },
  })
}
