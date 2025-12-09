import { prisma } from '../../../lib/prisma'
import type { JobWithCompany } from '../../../lib/jobs/queryJobs'
import { buildJobSlugHref } from '../../../lib/jobs/jobSlug'
import { getSiteUrl } from '../../../lib/seo/site'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 20000
export const dynamic = 'force-static'

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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ page: string }> }
) {
  const params = await ctx.params
  const pageNum = Math.max(1, Number(params.page) || 1)
  const where = buildHundredKWhereBase()

  const jobs = await prisma.job.findMany({
    where,
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

  const urlSet = jobs.map((job) => {
    const href = buildJobSlugHref(job as unknown as JobWithCompany)
    return {
      url: `${SITE_URL}${href}`,
      lastModified: job.updatedAt?.toISOString() ?? new Date().toISOString(),
    }
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlSet.map((u) => `  <url>
    <loc>${u.url}</loc>
    <lastmod>${u.lastModified}</lastmod>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
