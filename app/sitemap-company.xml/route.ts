// app/sitemap-company.xml/route.ts
// Sitemap for all /company/[slug] pages

import { prisma } from '../../lib/prisma'

const SITE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://www.6figjobs.com'

export const dynamic = 'force-dynamic'

export const revalidate = 60 * 60 * 24
export async function GET() {
  // Only include companies that actually have jobs (SEO best practice)
  const companies = await prisma.company.findMany({
    where: {
      jobCount: { gt: 0 }, // avoid dead pages
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
