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
  ctx: { params: { page: string } }
) {
  const pageNum = Math.max(1, Number(ctx.params.page) || 1)
  const where = buildHundredKWhereBase()

  const jobs = await prisma.job.findMany({
    where,
    select: {
      id: true,
      title: true,
      company: true,
      companyRef: { select: { slug: true } },
      postedAt: true,
      lastSeenAt: true,
    },
    orderBy: [
      { postedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    skip: (pageNum - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  const urls = jobs
    .map((job: any) => {
      const href = buildJobSlugHref(job as JobWithCompany)
      const lastmodSource = job.lastSeenAt || job.postedAt
      const lastmod = (lastmodSource || new Date()).toISOString()
      return `<url><loc>${SITE_URL}${href}</loc><lastmod>${lastmod}</lastmod></url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
