// app/sitemap-browse.xml/route.ts
// Sitemap for category + location browse pages (programmatic SEO)

import { NextResponse } from 'next/server'

import { buildBrowseSitemapReport } from '@/lib/seo/browseSitemap'
import { buildFallbackUrlsetResponse } from '@/lib/seo/fallbackSitemap'
import { getSiteUrl } from '@/lib/seo/site'
import { prisma } from '@/lib/prisma'
import { buildWhere } from '@/lib/jobs/queryJobs'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '@/lib/seo/sitemapResponseMeta'
import {
  buildPhase1SilencedSitemapResponse,
  isSitemapFamilyEnabled,
} from '@/lib/seo/indexingPhase'

const SITE_URL = getSiteUrl()

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
  if (!isSitemapFamilyEnabled('sitemap-browse')) {
    return buildPhase1SilencedSitemapResponse('sitemap-browse')
  }
  try {
    const [report, lastmod] = await Promise.all([
      buildBrowseSitemapReport(3),
      getGlobalLastmod(),
    ])
    // Static specialty pages — always included, high-value pSEO targets
    const SPECIALTY_PATHS = [
      '/jobs/visa-sponsorship',
      '/jobs/no-degree',
    ]

    const urls = [
      ...SPECIALTY_PATHS.map((p) => `${SITE_URL}${p}`),
      ...report.included.map((row) => `${SITE_URL}${row.path}`),
    ]
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
  ${buildSitemapMetaComment('sitemap-browse')}
</urlset>`

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        ...buildSitemapMetaHeaders('sitemap-browse'),
      },
    })
  } catch (error) {
    return buildFallbackUrlsetResponse('sitemap-browse', [], error)
  }
}
