// app/sitemap-blog.xml/route.ts
// Sitemap for blog/editorial content pages

import { NextResponse } from 'next/server'
import { getAllPosts } from '@/lib/blog/posts'
import { getSiteUrl } from '@/lib/seo/site'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '@/lib/seo/sitemapResponseMeta'
import {
  buildPhase1SilencedSitemapResponse,
  isSitemapFamilyEnabled,
} from '@/lib/seo/indexingPhase'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'
export const revalidate = 86400

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function GET() {
  if (!isSitemapFamilyEnabled('sitemap-blog')) {
    return buildPhase1SilencedSitemapResponse('sitemap-blog')
  }
  const posts = getAllPosts()

  const urls = [
    { url: `${SITE_URL}/blog`, lastmod: posts[0]?.updatedAt ?? new Date().toISOString() },
    ...posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastmod: p.updatedAt,
    })),
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ url, lastmod }) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
  </url>`,
  )
  .join('\n')}
  ${buildSitemapMetaComment('sitemap-blog')}
</urlset>`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...buildSitemapMetaHeaders('sitemap-blog'),
    },
  })
}
