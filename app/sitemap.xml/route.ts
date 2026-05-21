// app/sitemap.xml/route.ts

import { getSiteUrl } from '../../lib/seo/site'
import { resolveCoreSitemapFamilies } from '../../lib/seo/coreSitemapFamilies'
import { resolveOptionalSitemapFamilies } from '../../lib/seo/optionalSitemapFamilies'
import { prisma } from '../../lib/prisma'
import { BLOG_POSTS } from '../../lib/blog/posts'

function hasBlogPosts(): boolean {
  return BLOG_POSTS.length > 0
}

async function hasSkillPages(): Promise<boolean> {
  // Skills sitemap is always present if the site has active jobs with tech stack data
  try {
    const count = await prisma.job.count({
      where: { isExpired: false, techStack: { not: null } },
    })
    return count > 0
  } catch { return true }
}

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'
export const revalidate = 43200 // 24h

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function getLastmod(): Promise<string> {
  try {
    const agg = await prisma.job.aggregate({ _max: { updatedAt: true } })
    return (agg._max.updatedAt ?? new Date()).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

export async function GET() {
  const hasBlog = hasBlogPosts()
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
    lastmod,
    hasSkills,
  ] = await Promise.all([
    resolveOptionalSitemapFamilies('sitemap.xml'),
    resolveCoreSitemapFamilies('sitemap.xml'),
    getLastmod(),
    hasSkillPages(),
  ])
  const sitemaps = [
    ...(hasJobUrls ? ['sitemap-jobs.xml'] : []),
    ...(hasCompanyUrls ? ['sitemap-company.xml'] : []),
    ...(cityUrls.length > 0 ? ['sitemap-city.xml'] : []),
    ...(hasRemoteUrls ? ['sitemap-remote.xml'] : []),
    ...(hasSalaryUrls ? ['sitemap-salary.xml'] : []),
    ...(hasCountryUrls ? ['sitemap-country.xml'] : []),
    ...(hasCategoryUrls ? ['sitemap-category.xml'] : []),
    ...(hasLevelUrls ? ['sitemap-level.xml'] : []),
    ...(hasBrowseUrls ? ['sitemap-browse.xml'] : []),
    ...(hasSliceUrls ? ['sitemap-slices.xml'] : []),
    ...(hasBlog ? ['sitemap-blog.xml'] : []),
    ...(hasSkills ? ['sitemap-skills.xml'] : []),
  ]
  const fallbackParts = [
    ...(failedFamilies.length > 0 ? [`optional_families=${failedFamilies.join(',')}`] : []),
    ...(failedCoreFamilies.length > 0
      ? [`core_families=${failedCoreFamilies.join(',')}`]
      : []),
  ]
  const fallbackComment =
    fallbackParts.length > 0
      ? `\n  <!-- fallback_used=1 ${fallbackParts.join(' ')} -->`
      : ''

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map((s) => {
    const loc = escapeXml(`${SITE_URL}/${s}`)
    return `  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`
  })
  .join('\n')}${fallbackComment}
</sitemapindex>`

  const headers: Record<string, string> = {
    'Content-Type': 'application/xml; charset=utf-8',
  }
  if (fallbackParts.length > 0) {
    headers['X-Sitemap-Fallback'] = '1'
  }

  return new Response(xml, {
    headers,
  })
}
