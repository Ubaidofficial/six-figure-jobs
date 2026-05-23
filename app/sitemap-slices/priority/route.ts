// app/sitemap-slices/priority/route.ts
// Priority slices: high-signal role salary slices

import { NextResponse } from 'next/server'
import { buildSliceSitemapEntries } from '../../../lib/seo/slicesSitemap'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../../lib/seo/sitemapResponseMeta'

export const dynamic = 'force-dynamic'
export const revalidate = 86400 // 24h

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const entries = await buildSliceSitemapEntries('priority')

  const urls = entries
    .map(
      ({ loc, lastmod }) => `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
    )

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
  ${buildSitemapMetaComment('sitemap-slices-priority')}
</urlset>`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...buildSitemapMetaHeaders('sitemap-slices-priority'),
    },
  })
}
