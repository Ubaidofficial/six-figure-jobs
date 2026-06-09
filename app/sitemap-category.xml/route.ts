import { prisma } from '../../lib/prisma'
import { buildFallbackUrlsetResponse } from '../../lib/seo/fallbackSitemap'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { getSiteUrl } from '../../lib/seo/site'
import { JOB_CATEGORY_MAP, JOB_CATEGORY_SLUGS } from '../../lib/seo/jobCategories'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'
import {
  buildPhase1SilencedSitemapResponse,
  isSitemapFamilyEnabled,
} from '../../lib/seo/indexingPhase'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isSitemapFamilyEnabled('sitemap-category')) {
    return buildPhase1SilencedSitemapResponse('sitemap-category')
  }
  try {
    const MIN_INDEXABLE_JOBS = 3
    const categories = JOB_CATEGORY_SLUGS

    const baseWhere = buildWhere({})
    const roleRows = await prisma.job.groupBy({
      by: ['roleSlug'],
      where: { ...baseWhere, roleSlug: { not: null } },
      _count: { _all: true },
      _max: { updatedAt: true },
    })

    const roleStats = roleRows
      .map((row) => ({
        slug: row.roleSlug ? String(row.roleSlug).toLowerCase() : '',
        count: Number(row._count?._all ?? 0),
        lastmod: row._max?.updatedAt ?? null,
      }))
      .filter((row) => row.slug)

    const urls = categories
      .map((cat) => {
        const slugs = (JOB_CATEGORY_MAP[cat]?.roleSlugs || []).map((s) => s.toLowerCase())
        let total = 0
        let lastmod: Date | null = null
        for (const row of roleStats) {
          if (slugs.some((slug) => row.slug === slug || row.slug.includes(slug))) {
            total += row.count
            if (row.lastmod && (!lastmod || row.lastmod > lastmod)) {
              lastmod = row.lastmod
            }
          }
        }
        if (total < MIN_INDEXABLE_JOBS) return null
        return {
          url: `${SITE_URL}/jobs/category/${cat}`,
          lastModified: (lastmod ?? new Date()).toISOString(),
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
  ${buildSitemapMetaComment('sitemap-category')}
</urlset>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        ...buildSitemapMetaHeaders('sitemap-category'),
      },
    })
  } catch (error) {
    return buildFallbackUrlsetResponse('sitemap-category', [], error)
  }
}
