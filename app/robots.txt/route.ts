// app/robots.txt/route.ts
import { NextResponse } from 'next/server'
import { getSiteUrl } from '../../lib/seo/site'
import { resolveCoreSitemapFamilies } from '../../lib/seo/coreSitemapFamilies'
import { resolveOptionalSitemapFamilies } from '../../lib/seo/optionalSitemapFamilies'

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

  const [
    { cityUrls, hasRemoteUrls, hasCountryUrls, hasSliceUrls, failedFamilies },
    {
      hasJobUrls,
      hasCompanyUrls,
      hasSalaryUrls,
      hasCategoryUrls,
      hasLevelUrls,
      hasBrowseUrls,
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
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    ...(hasJobUrls ? [`Sitemap: ${SITE_URL}/sitemap-jobs.xml`] : []),
    ...(hasCompanyUrls ? [`Sitemap: ${SITE_URL}/sitemap-company.xml`] : []),
    ...(cityUrls.length > 0 ? [`Sitemap: ${SITE_URL}/sitemap-city.xml`] : []),
    ...(hasSalaryUrls ? [`Sitemap: ${SITE_URL}/sitemap-salary.xml`] : []),
    ...(hasRemoteUrls ? [`Sitemap: ${SITE_URL}/sitemap-remote.xml`] : []),
    ...(hasCountryUrls ? [`Sitemap: ${SITE_URL}/sitemap-country.xml`] : []),
    ...(hasCategoryUrls ? [`Sitemap: ${SITE_URL}/sitemap-category.xml`] : []),
    ...(hasLevelUrls ? [`Sitemap: ${SITE_URL}/sitemap-level.xml`] : []),
    ...(hasBrowseUrls ? [`Sitemap: ${SITE_URL}/sitemap-browse.xml`] : []),
    ...(hasSliceUrls ? [`Sitemap: ${SITE_URL}/sitemap-slices.xml`] : []),
    `Sitemap: ${SITE_URL}/sitemap-blog.xml`,
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
