// app/sitemap-company.xml/route.ts
// Sitemap for all /company/[slug] pages

import { prisma } from '../../lib/prisma'

const SITE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://www.6figjobs.com'

export const dynamic = 'force-dynamic'
export const revalidate = 43200
export async function GET() {
  const MIN_INDEXABLE_JOBS = 3

  const liveCounts = await prisma.job.groupBy({
    by: ['companyId'],
    where: { isExpired: false },
    _count: { _all: true },
  })

  const companyIds = liveCounts
    .filter((row) => Number(row._count?._all ?? 0) >= MIN_INDEXABLE_JOBS)
    .map((row) => row.companyId)
    .filter((id): id is string => Boolean(id))

  const companies = companyIds.length
    ? await prisma.company.findMany({
        where: {
          id: { in: companyIds },
        },
        select: {
          slug: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 50000, // Google soft limit
      })
    : []

  const urls = companies
    // Explicitly type 'c' as any to satisfy TypeScript strict mode
    .filter((c: any) => c.slug)
    .map((c: any) => {
      const loc = `${SITE_URL}/company/${c.slug}`
      const lastmod = c.updatedAt.toISOString()
      return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`
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
