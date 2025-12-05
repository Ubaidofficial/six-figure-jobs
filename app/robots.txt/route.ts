// app/robots.txt/route.ts
import { NextResponse } from 'next/server'
import { getSiteUrl } from '../../lib/seo/site'

const SITE_URL = getSiteUrl()

export const dynamic = "force-static"

export async function GET() {
  const body = [
    'User-agent: *',
    'Allow: /',
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
