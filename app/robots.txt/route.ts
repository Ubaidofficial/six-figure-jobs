// app/robots.txt/route.ts
import { NextResponse } from 'next/server'

import { BLOG_POSTS } from '../../lib/blog/posts'
import { getSiteUrl } from '../../lib/seo/site'
import { shouldAdvertiseSitemapFamily } from '../../lib/seo/sitemapPolicy'

const SITE_URL = getSiteUrl()

export const revalidate = 86400

function buildSitemapLines(): string[] {
  return [
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    ...(shouldAdvertiseSitemapFamily('jobs') ? [`Sitemap: ${SITE_URL}/sitemap-jobs.xml`] : []),
    ...(shouldAdvertiseSitemapFamily('company')
      ? [`Sitemap: ${SITE_URL}/sitemap-company.xml`]
      : []),
    ...(shouldAdvertiseSitemapFamily('salary')
      ? [`Sitemap: ${SITE_URL}/sitemap-salary.xml`]
      : []),
    ...(BLOG_POSTS.length > 0 && shouldAdvertiseSitemapFamily('blog')
      ? [`Sitemap: ${SITE_URL}/sitemap-blog.xml`]
      : []),
  ]
}

export async function GET() {
  if (process.env.NEXT_PUBLIC_SITE_URL?.includes('staging')) {
    return new NextResponse('User-agent: *\nDisallow: /', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

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
    ...buildSitemapLines(),
    '',
  ].join('\n')

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
