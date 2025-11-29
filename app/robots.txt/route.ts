// app/robots.txt/route.ts
import { NextResponse } from 'next/server'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://remote100k.com'

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
    '',
  ].join('\n')

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
