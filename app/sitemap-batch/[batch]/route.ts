// app/sitemap-batch/[batch]/route.ts
// One released batch of pSEO pages, e.g. /sitemap-batch/1.xml. Each batch is its own sitemap file so Search Console
// reports indexing coverage per batch. An unreleased (or unknown) batch returns an empty <urlset> with 200 so it is
// never advertised and never errors. See lib/seo/pseoBatches.ts for the release controls.

import { getSiteUrl } from '../../../lib/seo/site'
import { collectPseoBatchEntries } from '../../../lib/seo/evergreenSitemap'
import { PSEO_BATCH_COUNT, getReleasedPseoBatch } from '../../../lib/seo/pseoBatches'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export async function GET(_req: Request, { params }: { params: Promise<{ batch: string }> }) {
  const { batch: raw } = await params
  const batch = Number.parseInt(String(raw).replace(/\.xml$/i, ''), 10)
  const valid = Number.isInteger(batch) && batch >= 1 && batch <= PSEO_BATCH_COUNT

  let entries: Awaited<ReturnType<typeof collectPseoBatchEntries>> = []
  let failed = false
  if (valid) {
    try {
      entries = await collectPseoBatchEntries(batch)
    } catch {
      failed = true // database blip: serve an empty file briefly, never a 500 that Search Console records as an error
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => {
    const lastmod = e.lastmod ? `\n    <lastmod>${e.lastmod.toISOString()}</lastmod>` : ''
    return `  <url>\n    <loc>${escapeXml(`${SITE_URL}${e.path}`)}</loc>${lastmod}\n  </url>`
  })
  .join('\n')}
  <!-- sitemap-batch batch=${valid ? batch : 'invalid'} released_through=${getReleasedPseoBatch()} urls=${entries.length} -->
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': failed
        ? 'public, max-age=60, s-maxage=60'
        : 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
