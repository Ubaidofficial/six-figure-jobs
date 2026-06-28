// app/sitemap.xml/route.ts

import { BLOG_POSTS } from '../../lib/blog/posts'
import { getSiteUrl } from '../../lib/seo/site'
import { shouldAdvertiseSitemapFamily } from '../../lib/seo/sitemapPolicy'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

const SITE_URL = getSiteUrl()

export const revalidate = 43200 // 12h

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildAdvertisedSitemaps(): string[] {
  return [
    'sitemap-hubs.xml',
    ...(shouldAdvertiseSitemapFamily('jobs') ? ['sitemap-jobs.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('company') ? ['sitemap-company.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('salary') ? ['sitemap-salary.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('city') ? ['sitemap-city.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('remote') ? ['sitemap-remote.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('country') ? ['sitemap-country.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('category') ? ['sitemap-category.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('level') ? ['sitemap-level.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('browse') ? ['sitemap-browse.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('slices') ? ['sitemap-slices.xml'] : []),
    ...(BLOG_POSTS.length > 0 && shouldAdvertiseSitemapFamily('blog') ? ['sitemap-blog.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('skills') ? ['sitemap-skills.xml'] : []),
  ]
}

export async function GET() {
  const lastmod = new Date().toISOString()
  const sitemaps = buildAdvertisedSitemaps()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map((path) => {
    const loc = escapeXml(`${SITE_URL}/${path}`)
    return `  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`
  })
  .join('\n')}
  ${buildSitemapMetaComment('sitemap')}
</sitemapindex>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...buildSitemapMetaHeaders('sitemap'),
    },
  })
}
