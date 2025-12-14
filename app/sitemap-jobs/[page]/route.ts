// app/sitemap-jobs/[page]/route.ts
import { prisma } from '../../../lib/prisma'
import type { JobWithCompany } from '../../../lib/jobs/queryJobs'
import { buildJobSlugHref } from '../../../lib/jobs/jobSlug'
import { getSiteUrl } from '../../../lib/seo/site'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 20000

export const dynamic = 'force-static'
export const revalidate = 60 * 60 * 24 // 24h

function buildHundredKWhereBase() {
  const threshold = BigInt(100_000)
  return {
    isExpired: false,
    OR: [
      { maxAnnual: { gte: threshold } },
      { minAnnual: { gte: threshold } },
      { isHighSalary: true },
      { isHundredKLocal: true },
    ],
  }
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(
  _req: Request,
  ctx: { params: { page: string } | Promise<{ page: string }> }
) {
  const params = await Promise.resolve(ctx.params)
  const pageNum = Math.max(1, Number(params.page) || 1)

  const jobs = await prisma.job.findMany({
    where: buildHundredKWhereBase(),
    select: {
      id: true,
      title: true,
      company: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    skip: (pageNum - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${jobs
  .map((job) => {
    const href = buildJobSlugHref(job as unknown as JobWithCompany)
    const loc = escapeXml(`${SITE_URL}${href}`)
    const lastmod = (job.updatedAt ?? new Date()).toISOString()
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
  })
  .join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
