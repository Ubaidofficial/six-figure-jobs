// app/sitemap-slices.xml/route.ts
// Sitemap for seeded role/country/remote salary slices (JobSlice)

import { NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'

export const revalidate = 3600

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

export async function GET() {
  const slices = await prisma.jobSlice.findMany({
    select: { slug: true, updatedAt: true, jobCount: true },
    where: {
      jobCount: { gt: 0 },
    },
    take: 5000,
  })

  const urls = slices.map((s) => {
    const loc = `${SITE_URL}/${s.slug}`
    const lastmod = s.updatedAt?.toISOString() ?? new Date().toISOString()
    return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq></url>`
  })

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
