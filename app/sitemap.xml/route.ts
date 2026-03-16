// app/sitemap.xml/route.ts

import { getSiteUrl } from '../../lib/seo/site'
import { resolveOptionalSitemapFamilies } from '../../lib/seo/optionalSitemapFamilies'

const SITE_URL = getSiteUrl()
const BUILD_LASTMOD = new Date().toISOString()

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
  const { cityUrls, hasRemoteUrls, hasCountryUrls, hasSliceUrls, failedFamilies } =
    await resolveOptionalSitemapFamilies('sitemap.xml')
  const sitemaps = [
    'sitemap-jobs.xml',
    'sitemap-company.xml',
    ...(cityUrls.length > 0 ? ['sitemap-city.xml'] : []),
    ...(hasRemoteUrls ? ['sitemap-remote.xml'] : []),
    'sitemap-salary.xml',
    ...(hasCountryUrls ? ['sitemap-country.xml'] : []),
    'sitemap-category.xml',
    'sitemap-level.xml',
    'sitemap-browse.xml',
    ...(hasSliceUrls ? ['sitemap-slices.xml'] : []),
  ]
  const fallbackComment =
    failedFamilies.length > 0
      ? `\n  <!-- fallback_used=1 optional_families=${failedFamilies.join(',')} -->`
      : ''

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map((s) => {
    const loc = escapeXml(`${SITE_URL}/${s}`)
    return `  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${BUILD_LASTMOD}</lastmod>
  </sitemap>`
  })
  .join('\n')}${fallbackComment}
</sitemapindex>`

  const headers: Record<string, string> = {
    'Content-Type': 'application/xml; charset=utf-8',
  }
  if (failedFamilies.length > 0) {
    headers['X-Sitemap-Fallback'] = '1'
  }

  return new Response(xml, {
    headers,
  })
}
