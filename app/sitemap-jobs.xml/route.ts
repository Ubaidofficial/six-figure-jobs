// app/sitemap-jobs.xml/route.ts
// Sitemap for all live /job/[slug] pages (100k+ focus)

import { prisma } from '../../lib/prisma'
import { buildJobSlugHref } from '../../lib/jobs/jobSlug'
import type { JobWithCompany } from '../../lib/jobs/queryJobs'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

export const dynamic = "force-static"

// Reuse the 100k+ filter logic we use elsewhere
function buildHundredKWhereBase() {
  const threshold = BigInt(100_000)
  return {
    isExpired: false,
    OR: [
      { maxAnnual: { gte: threshold } },
      { minAnnual: { gte: threshold } },
      { isHighSalary: true },      // new canonical flag
      { isHundredKLocal: true },   // keep legacy flag for safety
    ],
  }
}

export async function GET() {
  const hundredKWhereBase = buildHundredKWhereBase()

  const jobs = await prisma.job.findMany({
    where: hundredKWhereBase,
    select: {
      id: true,
      title: true,
      company: true,
      companyRef: {
        select: {
          slug: true,
        },
      },
      postedAt: true,
      lastSeenAt: true,
    },
    orderBy: {
      postedAt: 'desc',
    },
    take: 50000, // keep under per-sitemap soft limit
  })

  const urls = jobs
    // Explicitly type job as any to fix build error
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