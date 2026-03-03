import { getSiteUrl } from '../lib/seo/site'

type FetchResult = {
  url: string
  ok: boolean
  status: number
  bytes: number
  isIndex: boolean
  urls: number
  sitemaps: number
}

function extractLocs(xml: string): string[] {
  const locs: string[] = []
  const re = /<loc>([^<]+)<\/loc>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const loc = String(m[1] || '').trim()
    if (loc) locs.push(loc)
  }
  return locs
}

function countUrls(xml: string): number {
  return (xml.match(/<url>/g) || []).length
}

function countSitemaps(xml: string): number {
  return (xml.match(/<sitemap>/g) || []).length
}

async function fetchSitemap(url: string): Promise<FetchResult> {
  const res = await fetch(url, {
    headers: { Accept: 'application/xml,text/xml,*/*' },
  })
  const text = await res.text()

  const bytes = Buffer.byteLength(text, 'utf8')
  const isIndex = text.includes('<sitemapindex')
  const urls = countUrls(text)
  const sitemaps = countSitemaps(text)

  return {
    url,
    ok: res.ok,
    status: res.status,
    bytes,
    isIndex,
    urls,
    sitemaps,
  }
}

async function main() {
  const SITE_URL = getSiteUrl()
  const indexUrl = `${SITE_URL}/sitemap.xml`

  console.log(`[sitemap] Fetching index: ${indexUrl}`)
  const indexRes = await fetchSitemap(indexUrl)
  console.log(
    `[sitemap] index status=${indexRes.status} bytes=${indexRes.bytes} sitemaps=${indexRes.sitemaps}`,
  )
  if (!indexRes.ok) process.exitCode = 1

  const indexXml = await (await fetch(indexUrl)).text()
  const sitemapUrls = extractLocs(indexXml)

  const visited = new Set<string>()
  const results: FetchResult[] = []

  for (const url of sitemapUrls) {
    if (visited.has(url)) continue
    visited.add(url)

    console.log(`[sitemap] Fetching: ${url}`)
    const r = await fetchSitemap(url)
    results.push(r)
    console.log(
      `[sitemap]  status=${r.status} bytes=${r.bytes} ${r.isIndex ? `sitemaps=${r.sitemaps}` : `urls=${r.urls}`}`,
    )
    if (!r.ok) process.exitCode = 1

    if (r.isIndex) {
      const xml = await (await fetch(url)).text()
      for (const shardUrl of extractLocs(xml)) {
        if (visited.has(shardUrl)) continue
        visited.add(shardUrl)
        console.log(`[sitemap] Fetching shard: ${shardUrl}`)
        const shard = await fetchSitemap(shardUrl)
        results.push(shard)
        console.log(
          `[sitemap]  status=${shard.status} bytes=${shard.bytes} urls=${shard.urls}`,
        )
        if (!shard.ok) process.exitCode = 1
      }
    }
  }

  const totalUrls = results.reduce((acc, r) => acc + (r.isIndex ? 0 : r.urls), 0)
  const totalSitemaps = results.reduce((acc, r) => acc + (r.isIndex ? r.sitemaps : 0), 0)
  const failures = results.filter((r) => !r.ok)

  console.log('='.repeat(60))
  console.log('[sitemap] SUMMARY')
  console.log(`[sitemap] sitemaps fetched: ${results.length} (index entries=${sitemapUrls.length})`)
  console.log(`[sitemap] indexes discovered: ${totalSitemaps}`)
  console.log(`[sitemap] url entries discovered: ${totalUrls}`)
  if (failures.length) {
    console.log(`[sitemap] failures: ${failures.length}`)
    failures.slice(0, 10).forEach((f) => console.log(`  ${f.status} ${f.url}`))
  }
  console.log('='.repeat(60))
}

main().catch((err) => {
  console.error('[sitemap] error:', err)
  process.exitCode = 1
})

