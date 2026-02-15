import { prisma } from '../../lib/prisma'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { countryCodeToSlug } from '../../lib/seo/countrySlug'
import { getSiteUrl } from '../../lib/seo/site'
import {
  MIN_COUNTRY_INDEXABLE_JOBS,
  isCountryPageIndexable,
} from '../../lib/seo/indexabilityGates'

const SITE_URL = getSiteUrl()
const MIN_INDEXABLE_JOBS = MIN_COUNTRY_INDEXABLE_JOBS

export const dynamic = 'force-dynamic'

export async function GET() {
  const countryCodes = ['US', 'GB', 'CA', 'DE', 'AU', 'FR', 'NL', 'SE']

  const urls = (
    await Promise.all(
      countryCodes.map(async (countryCode) => {
        const where = buildWhere({
          countryCode,
          isHundredKLocal: true,
          page: 1,
          pageSize: 1,
        })

        const agg = await prisma.job.aggregate({
          where,
          _count: { _all: true },
          _max: { updatedAt: true },
        })

        const total = Number(agg._count?._all ?? 0)
        if (!isCountryPageIndexable(total)) return null

        const slug = countryCodeToSlug(countryCode)
        const lastmod = (agg._max.updatedAt ?? new Date()).toISOString()
      return {
        url: `${SITE_URL}/jobs/country/${slug}`,
        lastModified: lastmod,
        changeFrequency: 'daily',
        priority: 0.8,
      }
      }),
    )
  ).filter(Boolean) as Array<{
      url: string
      lastModified: string
      changeFrequency: string
      priority: number
    }>

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.url}</loc>
    <lastmod>${u.lastModified}</lastmod>
    <changefreq>${u.changeFrequency}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
