// app/sitemap-company.xml/route.ts
// Sitemap index for /company/[slug] pages (sharded)

import { buildFallbackUrlsetResponse } from '../../lib/seo/fallbackSitemap'
import { getSiteUrl } from '../../lib/seo/site'
import { getPublishedCompanyCandidateCount } from '../../lib/seo/companyPublishing'
import {
  getMaxCompanySitemapPages,
  getMaxCompanyUrlsPerPage,
} from '../../lib/seo/sitemapPolicy'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = getMaxCompanyUrlsPerPage()

export const dynamic = 'force-dynamic'
export const revalidate = 43200 // 24h

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  try {
    const total = await getPublishedCompanyCandidateCount()
    const totalPages = Math.min(
      Math.ceil(total / PAGE_SIZE),
      getMaxCompanySitemapPages(),
    )

    const lastmod = new Date().toISOString()
    const entries = Array.from({ length: totalPages }).map((_, i) => {
      const loc = escapeXml(`${SITE_URL}/sitemap-company/${i + 1}`)
      return `  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
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
