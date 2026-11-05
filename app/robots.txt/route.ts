// app/robots.txt/route.ts
import { NextResponse } from 'next/server'

import { getSiteUrl } from '../../lib/seo/site'
import { shouldAdvertiseSitemapFamily } from '../../lib/seo/sitemapPolicy'

const SITE_URL = getSiteUrl()

export const revalidate = 86400

// Only the index plus the jobs sitemap (for Google Jobs discovery). Child sitemaps are discovered through the index.
function buildSitemapLines(): string[] {
  return [
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    ...(shouldAdvertiseSitemapFamily('jobs') ? [`Sitemap: ${SITE_URL}/sitemap-jobs.xml`] : []),
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
