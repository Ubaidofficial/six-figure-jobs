// app/sitemap.xml/route.ts

import { BLOG_POSTS } from '../../lib/blog/posts'
import { getSiteUrl } from '../../lib/seo/site'
import { getLatestBlogUpdate, getLatestJobUpdate } from '../../lib/seo/evergreenSitemap'
import { shouldAdvertiseSitemapFamily } from '../../lib/seo/sitemapPolicy'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

const SITE_URL = getSiteUrl()

// Request-time: `lastmod` is read from the database (newest job update), which a deploy-time build cannot reach.
export const dynamic = 'force-dynamic'

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
  // `lastmod` must be the time the child's content last changed, not the time of this request: Google stops
  // trusting lastmod on sites where every entry always says "now". When the date is unknown it is omitted.
  const latestJob = await getLatestJobUpdate()
  const latestBlog = getLatestBlogUpdate()
  const lastmodFor = (path: string): string | null => {
    const d = path === 'sitemap-blog.xml' ? latestBlog : latestJob
    return d ? d.toISOString() : null
  }
  const sitemaps = buildAdvertisedSitemaps()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map((path) => {
    const loc = escapeXml(`${SITE_URL}/${path}`)
    const lastmod = lastmodFor(path)
    return `  <sitemap>
    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
  </sitemap>`
  })
  .join('\n')}
  ${buildSitemapMetaComment('sitemap')}
</sitemapindex>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      ...buildSitemapMetaHeaders('sitemap'),
    },
  })
}
