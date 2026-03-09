// app/sitemap.xml/route.ts

import { getSiteUrl } from '../../lib/seo/site'
import { getCitySitemapUrls } from '../../lib/seo/citySitemap'
import { hasCountrySitemapEntries } from '../../lib/seo/countrySitemap'
import { hasRemoteRoleSitemapEntries } from '../../lib/seo/remoteSitemap'
import { hasSliceSitemapEntries } from '../../lib/seo/slicesSitemap'

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
  const [cityUrls, hasRemoteUrls, hasCountryUrls, hasSliceUrls] = await Promise.all([
    getCitySitemapUrls(),
    hasRemoteRoleSitemapEntries(),
    hasCountrySitemapEntries(),
    hasSliceSitemapEntries(),
  ])
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
  .join('\n')}
</sitemapindex>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
