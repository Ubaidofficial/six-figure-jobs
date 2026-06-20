// app/sitemap-slices/longtail/route.ts
// Longtail slices: modest job counts, exclude very thin pages

import { NextResponse } from 'next/server'
import { buildSliceSitemapEntries } from '../../../lib/seo/slicesSitemap'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../../lib/seo/sitemapResponseMeta'
import {
  buildPhase1SilencedSitemapResponse,
  isSitemapFamilyEnabled,
} from '../../../lib/seo/indexingPhase'

export const revalidate = 86400

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  if (!isSitemapFamilyEnabled('sitemap-slices')) {
    return buildPhase1SilencedSitemapResponse('sitemap-slices-longtail')
  }
  const entries = await buildSliceSitemapEntries('longtail')

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
  ${buildSitemapMetaComment('sitemap-slices-longtail')}
</urlset>`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...buildSitemapMetaHeaders('sitemap-slices-longtail'),
    },
  })
}
