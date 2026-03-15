import { prisma } from '../../lib/prisma'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { buildSliceCanonicalPath } from '../../lib/seo/canonical'
import { SALARY_TIERS, type SalaryTierId } from '../../lib/jobs/salaryTiers'
import { isSalaryTierPageIndexable } from '../../lib/seo/indexabilityGates'
import { getSiteUrl } from '../../lib/seo/site'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'

type SalarySitemapUrl = {
  url: string
  lastModified: string
  changeFrequency: string
  priority: number
}

export async function GET() {
  const urls = (
    await Promise.all(
      (Object.keys(SALARY_TIERS) as SalaryTierId[]).map(async (tierId) => {
        const tier = SALARY_TIERS[tierId]
        const path = buildSliceCanonicalPath({
          minAnnual: tier.minAnnualUsd,
        } as any)

        const where = buildWhere({
          currency: 'USD',
          minAnnual: tier.minAnnualUsd,
          ...(tier.maxAnnualUsd ? { maxAnnual: tier.maxAnnualUsd } : {}),
        } as any)

        const [total, agg] = await Promise.all([
          prisma.job.count({ where }),
          prisma.job.aggregate({
            where,
            _max: { updatedAt: true },
          }),
        ])

        if (!isSalaryTierPageIndexable(total)) {
          return null
        }

        return {
          url: `${SITE_URL}${path}`,
          lastModified: (agg._max.updatedAt ?? new Date()).toISOString(),
          changeFrequency: 'daily',
          priority: 0.9,
        } satisfies SalarySitemapUrl
      }),
    )
  ).filter((entry): entry is SalarySitemapUrl => entry != null)

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
