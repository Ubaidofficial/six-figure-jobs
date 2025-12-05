// app/sitemap-slices/longtail/route.ts
// Longtail slices: modest job counts, exclude very thin pages

import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { getSiteUrl } from '../../../lib/seo/site'

export const revalidate = 3600

const SITE_URL = getSiteUrl()

export async function GET() {
  const slices = await prisma.jobSlice.findMany({
    select: { slug: true, updatedAt: true, jobCount: true },
    where: {
      jobCount: { gte: 5, lt: 20 },
    },
    orderBy: [{ updatedAt: 'desc' }, { jobCount: 'desc' }],
    take: 10000,
  })

  const urls = slices.map((s) => {
    const loc = `${SITE_URL}/${s.slug}`
    const lastmod = s.updatedAt?.toISOString() ?? new Date().toISOString()
    return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq></url>`
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
