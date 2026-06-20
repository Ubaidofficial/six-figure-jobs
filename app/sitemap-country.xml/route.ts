import { getCountrySitemapUrls } from '../../lib/seo/countrySitemap'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'
import {
  buildPhase1SilencedSitemapResponse,
  isSitemapFamilyEnabled,
} from '../../lib/seo/indexingPhase'

export const revalidate = 43200

export async function GET() {
  if (!isSitemapFamilyEnabled('sitemap-country')) {
    return buildPhase1SilencedSitemapResponse('sitemap-country')
  }
  const urls = await getCountrySitemapUrls()
  if (urls.length === 0) {
    return new Response('Not found', { status: 404 })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.url}</loc>
    <lastmod>${u.lastModified}</lastmod>
  </url>`).join('\n')}
  ${buildSitemapMetaComment('sitemap-country')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...buildSitemapMetaHeaders('sitemap-country'),
    },
  })
}
