// app/sitemap-company.xml/route.ts
// Sitemap index for /company/[slug] pages (sharded)

import { cachedXmlResponse } from '../../lib/seo/cachedSitemap'
import { buildFallbackUrlsetResponse } from '../../lib/seo/fallbackSitemap'
import { getSiteUrl } from '../../lib/seo/site'
import { getPublishedCompanyCandidateCount, getPublishedCompanyCandidatesPage } from '../../lib/seo/companyPublishing'
import { areCompanyPagesReleased } from '../../lib/seo/sitemapWaves'
import { sitemapDate } from '../../lib/seo/lastmod'
import {
  getMaxCompanySitemapPages,
  getMaxCompanyUrlsPerPage,
} from '../../lib/seo/sitemapPolicy'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = getMaxCompanyUrlsPerPage()

export const dynamic = 'force-dynamic' // built per request: the deploy-time build cannot reach the database

// A file is dated by the newest <lastmod> among its own companies (the day their newest live job was posted), from the
// same cached manifest the file is built from. The database query this replaced (newest job at any company) gave no
// date on production (2026-11-26; the cause was not confirmed), so every file went undated.
async function getCompanyFileLastmod(page: number): Promise<string | null> {
  const rows = await getPublishedCompanyCandidatesPage(page, PAGE_SIZE)
  let newest: string | null = null
  for (const row of rows) {
    const day = sitemapDate(row.latestJobPostedAt)
    if (day && (!newest || day > newest)) newest = day
  }
  return newest
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
    const published = await getPublishedCompanyCandidateCount()
    // Company pages are noindex before their sitemap wave (lib/seo/sitemapWaves.ts), so no files are listed until then.
    const total = areCompanyPagesReleased() ? published : 0
    const totalPages = Math.min(
      Math.ceil(total / PAGE_SIZE),
      getMaxCompanySitemapPages(),
    )
    const lastmods = await Promise.all(Array.from({ length: totalPages }, (_, i) => getCompanyFileLastmod(i + 1)))
    const entries = lastmods.map((lastmod, i) => {
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
