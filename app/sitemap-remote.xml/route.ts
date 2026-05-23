// app/sitemap-remote.xml/route.ts
import { collectRemoteRoleRows } from '../../lib/seo/remoteSitemap'
import { getSiteUrl } from '../../lib/seo/site'
import { getMaxRemoteSitemapUrls } from '../../lib/seo/sitemapPolicy'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

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

export async function GET() {
  const rows = (await collectRemoteRoleRows()).slice(0, getMaxRemoteSitemapUrls())
  if (rows.length === 0) {
    return new Response('Not found', { status: 404 })
  }

  const urls: string[] = []

  for (const row of rows) {
    const loc = escapeXml(`${SITE_URL}/remote/${row.roleSlug}`)
    const lastmod = row.lastmod

    urls.push(
      `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
    )
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
  ${buildSitemapMetaComment('sitemap-remote')}
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...buildSitemapMetaHeaders('sitemap-remote'),
    },
  })
}
