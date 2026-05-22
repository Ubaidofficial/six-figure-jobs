// app/robots.txt/route.ts
import { NextResponse } from 'next/server'
import { getSiteUrl } from '../../lib/seo/site'
import { resolveCoreSitemapFamilies } from '../../lib/seo/coreSitemapFamilies'
import { resolveOptionalSitemapFamilies } from '../../lib/seo/optionalSitemapFamilies'
import { BLOG_POSTS } from '../../lib/blog/posts'
import { shouldAdvertiseSitemapFamily } from '../../lib/seo/sitemapPolicy'

function hasBlogPosts(): boolean {
  return BLOG_POSTS.length > 0
}

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'

export const revalidate = 86400
export async function GET() {
  // Block staging from indexing entirely
  if (process.env.NEXT_PUBLIC_SITE_URL?.includes('staging')) {
    return new NextResponse('User-agent: *\nDisallow: /', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const hasBlog = hasBlogPosts()
  const [
    { failedFamilies },
    {
      hasJobUrls,
      failedFamilies: failedCoreFamilies,
    },
  ] = await Promise.all([
    resolveOptionalSitemapFamilies('robots.txt'),
    resolveCoreSitemapFamilies('robots.txt'),
  ])
  const fallbackParts = [
    ...(failedFamilies.length > 0 ? [`optional_families=${failedFamilies.join(',')}`] : []),
    ...(failedCoreFamilies.length > 0
      ? [`core_families=${failedCoreFamilies.join(',')}`]
      : []),
  ]
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /search',
    'Disallow: /api/',
    'Disallow: /ubaid93/',
    '',
    'User-agent: GPTBot',
    'Disallow: /api/',
    '',
    'User-agent: anthropic-ai',
    'Disallow: /api/',
    '',
    'User-agent: ClaudeBot',
    'Disallow: /api/',
    '',
    ...(fallbackParts.length > 0
      ? [`# fallback_used=1 ${fallbackParts.join(' ')}`, '']
      : []),
    // Only list the sitemap index — child sitemaps are discovered through it.
    // Listing both creates duplicate entries in GSC.
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    // Also list sitemap-jobs.xml directly: Google prioritises job sitemaps
    // and having it explicitly here speeds up job discovery.
    ...(hasJobUrls && shouldAdvertiseSitemapFamily('jobs')
      ? [`Sitemap: ${SITE_URL}/sitemap-jobs.xml`]
      : []),
    ...(hasBlog && shouldAdvertiseSitemapFamily('blog')
      ? [`Sitemap: ${SITE_URL}/sitemap-blog.xml`]
      : []),
    '',
  ].join('\n')

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...(fallbackParts.length > 0 ? { 'X-Robots-Fallback': '1' } : {}),
    },
  })
}
