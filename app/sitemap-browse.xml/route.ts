// app/sitemap-browse.xml/route.ts
// Sitemap for category + location browse pages (programmatic SEO)

import { NextResponse } from 'next/server'

import { buildBrowseSitemapReport } from '@/lib/seo/browseSitemap'
import { buildFallbackUrlsetResponse } from '@/lib/seo/fallbackSitemap'
import { getSiteUrl } from '@/lib/seo/site'
import { prisma } from '@/lib/prisma'
import { buildWhere } from '@/lib/jobs/queryJobs'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'
export const revalidate = 3600

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function getGlobalLastmod(): Promise<string> {
  try {
    const agg = await prisma.job.aggregate({
      where: buildWhere({}),
      _max: { updatedAt: true },
    })
    return (agg._max.updatedAt ?? new Date()).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

export async function GET() {
  try {
    const [report, lastmod] = await Promise.all([
      buildBrowseSitemapReport(3),
      getGlobalLastmod(),
    ])
    const urls = report.included.map((row) => `${SITE_URL}${row.path}`)
    const uniqueUrls = Array.from(new Set(urls))

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>`

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    })
  } catch (error) {
    return buildFallbackUrlsetResponse('sitemap-browse', [], error)
  }
}
