// app/sitemap-company.xml/route.ts
// Sitemap index for /company/[slug] pages (sharded)

import { cachedXmlResponse } from '../../lib/seo/cachedSitemap'
import { buildFallbackUrlsetResponse } from '../../lib/seo/fallbackSitemap'
import { getSiteUrl } from '../../lib/seo/site'
import { getPublishedCompanyCandidateCount } from '../../lib/seo/companyPublishing'
import { areCompanyPagesReleased } from '../../lib/seo/sitemapWaves'
import { prisma } from '../../lib/prisma'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { sitemapDate } from '../../lib/seo/lastmod'
import {
  getMaxCompanySitemapPages,
  getMaxCompanyUrlsPerPage,
} from '../../lib/seo/sitemapPolicy'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = getMaxCompanyUrlsPerPage()

export const dynamic = 'force-dynamic' // built per request: the deploy-time build cannot reach the database

// The newest job posted at a company: Company.updatedAt moves on every scraper re-sync, so it is not a content date.
// Null (no <lastmod>) when there is none or the database cannot be reached: never the request time.
async function getCompaniesLastmod(): Promise<string | null> {
  try {
    const agg = await prisma.job.aggregate({
      where: { ...buildWhere({}), companyId: { not: null } },
      _max: { createdAt: true },
    })
    return sitemapDate(agg._max.createdAt)
  } catch {
    return null
  }
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function buildCompanyIndex(): Promise<Response> {
  try {
    const [published, lastmod] = await Promise.all([
      getPublishedCompanyCandidateCount(),
      getCompaniesLastmod(),
    ])
    // Company pages are noindex before their sitemap wave (lib/seo/sitemapWaves.ts), so no files are listed until then.
    const total = areCompanyPagesReleased() ? published : 0
    const totalPages = Math.min(
      Math.ceil(total / PAGE_SIZE),
      getMaxCompanySitemapPages(),
    )
    const entries = Array.from({ length: totalPages }).map((_, i) => {
      const loc = escapeXml(`${SITE_URL}/sitemap-company/${i + 1}`)
      return `  <sitemap>
    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
  </sitemap>`
    })

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
  ${buildSitemapMetaComment('sitemap-company')}
</sitemapindex>`

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        ...buildSitemapMetaHeaders('sitemap-company'),
      },
    })
  } catch (error) {
    return buildFallbackUrlsetResponse('sitemap-company', [], error)
  }
}

export async function GET() {
  return cachedXmlResponse('sitemap-company', buildCompanyIndex)
}
