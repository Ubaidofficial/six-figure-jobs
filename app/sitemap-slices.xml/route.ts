// app/sitemap-slices.xml/route.ts
// Sitemap index for slice shards (priority + longtail)

import { getSiteUrl } from '../../lib/seo/site'
import { buildSliceSitemapEntries, type SliceShard } from '../../lib/seo/slicesSitemap'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'
export const revalidate = 43200 // 24h

type ShardConfig = {
  shard: SliceShard
  path: string
}

const SHARDS: ShardConfig[] = [
  { shard: 'priority', path: 'sitemap-slices/priority' },
  { shard: 'longtail', path: 'sitemap-slices/longtail' },
]

export async function GET() {
  const checks = await Promise.all(
    SHARDS.map(async ({ shard, path }) => {
      const hasUrls = (await buildSliceSitemapEntries(shard, { limit: 1 })).length > 0
      return hasUrls ? path : null
    }),
  )

  const entries = checks.filter(Boolean) as string[]
  if (entries.length === 0) {
    return new Response('Not found', { status: 404 })
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (loc) => `  <sitemap>
    <loc>${SITE_URL}/${loc}</loc>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>`

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
