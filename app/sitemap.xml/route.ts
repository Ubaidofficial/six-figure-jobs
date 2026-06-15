// app/sitemap.xml/route.ts

import { getSiteUrl } from '../../lib/seo/site'
import { resolveCoreSitemapFamilies } from '../../lib/seo/coreSitemapFamilies'
import { resolveOptionalSitemapFamilies } from '../../lib/seo/optionalSitemapFamilies'
import { prisma } from '../../lib/prisma'
import { BLOG_POSTS } from '../../lib/blog/posts'
import { shouldAdvertiseSitemapFamily } from '../../lib/seo/sitemapPolicy'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

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

import { unstable_cache } from 'next/cache'

const getSitemapData = unstable_cache(
  async () => {
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

    return {
      hasBlog,
      cityUrls,
      hasRemoteUrls,
      hasCountryUrls,
      hasSliceUrls,
      failedFamilies,
      hasJobUrls,
      hasCompanyUrls,
      hasSalaryUrls,
      hasCategoryUrls,
      hasLevelUrls,
      hasBrowseUrls,
      failedCoreFamilies,
      lastmod,
      hasSkills,
    }
  },
  ['sitemap-index-v2'],
  { revalidate: 3600, tags: ['sitemap'] }
)

export async function GET() {
  const data = await getSitemapData()
  
  const sitemaps = [
    ...(data.hasJobUrls && shouldAdvertiseSitemapFamily('jobs') ? ['sitemap-jobs.xml'] : []),
    ...(data.hasCompanyUrls && shouldAdvertiseSitemapFamily('company') ? ['sitemap-company.xml'] : []),
    ...(data.cityUrls.length > 0 && shouldAdvertiseSitemapFamily('city') ? ['sitemap-city.xml'] : []),
    ...(data.hasRemoteUrls && shouldAdvertiseSitemapFamily('remote') ? ['sitemap-remote.xml'] : []),
    ...(data.hasSalaryUrls && shouldAdvertiseSitemapFamily('salary') ? ['sitemap-salary.xml'] : []),
    ...(data.hasCountryUrls && shouldAdvertiseSitemapFamily('country') ? ['sitemap-country.xml'] : []),
    ...(data.hasCategoryUrls && shouldAdvertiseSitemapFamily('category') ? ['sitemap-category.xml'] : []),
    ...(data.hasLevelUrls && shouldAdvertiseSitemapFamily('level') ? ['sitemap-level.xml'] : []),
    ...(data.hasBrowseUrls && shouldAdvertiseSitemapFamily('browse') ? ['sitemap-browse.xml'] : []),
    ...(data.hasSliceUrls && shouldAdvertiseSitemapFamily('slices') ? ['sitemap-slices.xml'] : []),
    ...(data.hasBlog && shouldAdvertiseSitemapFamily('blog') ? ['sitemap-blog.xml'] : []),
    ...(data.hasSkills && shouldAdvertiseSitemapFamily('skills') ? ['sitemap-skills.xml'] : []),
  ]
  const fallbackParts = [
    ...(data.failedFamilies.length > 0 ? [`optional_families=${data.failedFamilies.join(',')}`] : []),
    ...(data.failedCoreFamilies.length > 0
      ? [`core_families=${data.failedCoreFamilies.join(',')}`]
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
    <lastmod>${data.lastmod}</lastmod>
  </sitemap>`
  })
  .join('\n')}${fallbackComment}
  ${buildSitemapMetaComment('sitemap')}
</sitemapindex>`

  const headers: Record<string, string> = {
    'Content-Type': 'application/xml; charset=utf-8',
    ...buildSitemapMetaHeaders('sitemap'),
  }
  if (fallbackParts.length > 0) {
    headers['X-Sitemap-Fallback'] = '1'
  }

  return new Response(xml, {
    headers,
  })
}
