// app/sitemap-slices.xml/route.ts
// Sitemap index for slice shards (priority + longtail)

import { sitemapDate } from '../../lib/seo/lastmod'
import { getSiteUrl } from '../../lib/seo/site'
import { buildSliceSitemapEntries, type SliceShard } from '../../lib/seo/slicesSitemap'
import { prisma } from '../../lib/prisma'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'
import {
  buildPhase1SilencedSitemapResponse,
  isSitemapFamilyEnabled,
} from '../../lib/seo/indexingPhase'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic' // built per request: the deploy-time build cannot reach the database

// Null (no <lastmod>) when there is no job or the database cannot be reached: never the request time.
async function getSlicesLastmod(): Promise<string | null> {
  try {
    const agg = await prisma.job.aggregate({ where: { isExpired: false }, _max: { createdAt: true } })
    return sitemapDate(agg._max.createdAt)
  } catch {
    return null
  }
}

type ShardConfig = {
  shard: SliceShard
  path: string
}

const SHARDS: ShardConfig[] = [
  { shard: 'priority', path: 'sitemap-slices/priority' },
  { shard: 'longtail', path: 'sitemap-slices/longtail' },
]

export async function GET() {
  if (!isSitemapFamilyEnabled('sitemap-slices')) {
    return buildPhase1SilencedSitemapResponse('sitemap-slices')
  }
  const [checks, lastmod] = await Promise.all([
    Promise.all(
      SHARDS.map(async ({ shard, path }) => {
        const hasUrls = (await buildSliceSitemapEntries(shard, { limit: 1 })).length > 0
        return hasUrls ? path : null
      }),
    ),
    getSlicesLastmod(),
  ])

  const entries = checks.filter(Boolean) as string[]
  if (entries.length === 0) {
    return new Response('Not found', { status: 404 })
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (loc) => `  <sitemap>
    <loc>${SITE_URL}/${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
  </sitemap>`,
  )
  .join('\n')}
  ${buildSitemapMetaComment('sitemap-slices')}
</sitemapindex>`

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...buildSitemapMetaHeaders('sitemap-slices'),
    },
  })
}
