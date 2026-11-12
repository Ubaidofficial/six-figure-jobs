// app/robots.txt/route.ts
import { NextResponse } from 'next/server'

import { getSiteUrl } from '../../lib/seo/site'
import { shouldAdvertiseSitemapFamily } from '../../lib/seo/sitemapPolicy'

const SITE_URL = getSiteUrl()

export const revalidate = 86400

const SLOW_CRAWLERS = ['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'PetalBot'] as const
// AI answer engines (they send visitors): slowed, not blocked.
const AI_ANSWER_CRAWLERS = ['PerplexityBot', 'OAI-SearchBot'] as const
// Social preview images (/job/<slug>/opengraph-image, /company/..., /jobs/<role>/...) are drawn on the server and each
// one blocks it for seconds: PerplexityBot fetched 160 in 5 minutes after the 2026-11-12 deploy and visitors' pages took
// 26 s. Only link previews (Facebook, X, LinkedIn, Slack: the default group) and Google need them, so the crawlers
// named here skip them. Pages themselves are not affected.
const NO_PREVIEW_IMAGES = 'Disallow: /*/opengraph-image'

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
    NO_PREVIEW_IMAGES,
    '',
    'User-agent: anthropic-ai',
    'Disallow: /api/',
    NO_PREVIEW_IMAGES,
    '',
    'User-agent: ClaudeBot',
    'Disallow: /api/',
    NO_PREVIEW_IMAGES,
    '',
    // SEO-tool crawlers bring no visitors; a crowd of them right after a deploy (empty caches) ran the server out of
    // memory on 2026-11-11. They honour Crawl-delay (seconds between requests); Googlebot ignores it and is not listed.
    // A crawler with its own group skips the `*` group, so the disallows are repeated.
    ...SLOW_CRAWLERS.map((bot) => `User-agent: ${bot}`),
    'Crawl-delay: 5',
    'Disallow: /search',
    'Disallow: /api/',
    'Disallow: /ubaid93/',
    NO_PREVIEW_IMAGES,
    '',
    ...AI_ANSWER_CRAWLERS.map((bot) => `User-agent: ${bot}`),
    'Crawl-delay: 2',
    'Disallow: /search',
    'Disallow: /api/',
    'Disallow: /ubaid93/',
    NO_PREVIEW_IMAGES,
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
