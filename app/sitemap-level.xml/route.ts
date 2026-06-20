import { prisma } from '../../lib/prisma'
import { buildFallbackUrlsetResponse } from '../../lib/seo/fallbackSitemap'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { getSiteUrl } from '../../lib/seo/site'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'
import {
  buildPhase1SilencedSitemapResponse,
  isSitemapFamilyEnabled,
} from '../../lib/seo/indexingPhase'

const SITE_URL = getSiteUrl()

export const revalidate = 43200

export async function GET() {
  if (!isSitemapFamilyEnabled('sitemap-level')) {
    return buildPhase1SilencedSitemapResponse('sitemap-level')
  }
  try {
    const MIN_INDEXABLE_JOBS = 3
    const levels = ['entry', 'mid', 'senior', 'lead', 'executive']
    const baseWhere = buildWhere({})

    const rows = await prisma.job.groupBy({
      by: ['experienceLevel'],
      where: { ...baseWhere, experienceLevel: { in: levels } },
      _count: { _all: true },
      _max: { updatedAt: true },
    })

    const counts = new Map<string, number>()
    const lastmods = new Map<string, Date>()
    for (const row of rows) {
      if (!row.experienceLevel) continue
      counts.set(String(row.experienceLevel).toLowerCase(), Number(row._count?._all ?? 0))
      const updatedAt = row._max?.updatedAt ?? null
      if (updatedAt) lastmods.set(String(row.experienceLevel).toLowerCase(), updatedAt)
    }

    const urls = levels
      .map((level) => {
        const total = counts.get(level) ?? 0
        if (total < MIN_INDEXABLE_JOBS) return null
        const lastmod = (lastmods.get(level) ?? new Date()).toISOString()
        return {
          url: `${SITE_URL}/jobs/level/${level}`,
          lastModified: lastmod,
        }
      })
      .filter(Boolean) as Array<{
        url: string
        lastModified: string
      }>

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.url}</loc>
    <lastmod>${u.lastModified}</lastmod>
  </url>`).join('\n')}
  ${buildSitemapMetaComment('sitemap-level')}
</urlset>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        ...buildSitemapMetaHeaders('sitemap-level'),
      },
    })
  } catch (error) {
    return buildFallbackUrlsetResponse('sitemap-level', [], error)
  }
}
