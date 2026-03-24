import { logRuntimeFallback } from '../runtime/fallback'
import { getSiteUrl } from './site'

const SITE_URL = getSiteUrl()

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildFallbackUrlsetResponse(
  scope: string,
  paths: string[] = [],
  error: unknown,
): Response {
  logRuntimeFallback(scope, error)

  const uniquePaths = Array.from(
    new Set(
      paths
        .map((path) => String(path || '').trim())
        .filter(Boolean),
    ),
  )
  const normalizedPaths = uniquePaths
  const lastmod = new Date().toISOString()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${normalizedPaths
  .map((path) => {
    const loc = escapeXml(`${SITE_URL}${path}`)
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
  })
  .join('\n')}
  <!-- fallback_used=1 -->
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Sitemap-Fallback': '1',
    },
  })
}
