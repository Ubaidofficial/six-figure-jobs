// app/robots.txt/route.ts
import { NextResponse } from 'next/server'
import { getSiteUrl } from '../../lib/seo/site'

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

  const body = [
    'User-agent: *',
    'Allow: /',
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
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    `Sitemap: ${SITE_URL}/sitemap-jobs.xml`,
    `Sitemap: ${SITE_URL}/sitemap-company.xml`,
    `Sitemap: ${SITE_URL}/sitemap-salary.xml`,
    `Sitemap: ${SITE_URL}/sitemap-remote.xml`,
    `Sitemap: ${SITE_URL}/sitemap-country.xml`,
    `Sitemap: ${SITE_URL}/sitemap-category.xml`,
    `Sitemap: ${SITE_URL}/sitemap-level.xml`,
    `Sitemap: ${SITE_URL}/sitemap-browse.xml`,
    `Sitemap: ${SITE_URL}/sitemap-slices.xml`,
    '',
  ].join('\n')

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
