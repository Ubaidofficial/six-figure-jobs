import { NextResponse } from 'next/server'
import { getSkillSitemapUrls } from '../../lib/seo/skillSitemap'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

export const dynamic = 'force-dynamic'
export const revalidate = 43200

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  try {
    const urls = await getSkillSitemapUrls()

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod)}</lastmod>
  </url>`,
  )
  .join('\n')}
  ${buildSitemapMetaComment('sitemap-skills')}
</urlset>`

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        ...buildSitemapMetaHeaders('sitemap-skills'),
      },
    })
  } catch (error) {
    console.error('[sitemap-skills] fallback_used=1 reason=builder_error', error)

    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- fallback_used=1 -->
  ${buildSitemapMetaComment('sitemap-skills')}
</urlset>`

    return new NextResponse(fallback, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Sitemap-Fallback': '1',
        ...buildSitemapMetaHeaders('sitemap-skills'),
      },
    })
  }
}
