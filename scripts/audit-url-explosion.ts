import { fetchText } from './seo-validate' // Re-use the fetchText from seo-validate? Wait, I should just write a generic fetch.

const SITEMAP_URL = process.env.SEO_BASE_URL
  ? `${process.env.SEO_BASE_URL}/sitemap-slices.xml`
  : 'http://localhost:3000/sitemap-slices.xml'

async function fetchSitemap(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) return ''
    throw new Error(`Failed to fetch ${url}: ${res.statusText}`)
  }
  return res.text()
}

function extractLocs(xml: string): string[] {
  const out: string[] = []
  const re = /<loc>([^<]+)<\/loc>/gi
  let match
  while ((match = re.exec(xml)) !== null) {
    out.push(match[1])
  }
  return out
}

async function run() {
  const args = process.argv.slice(2)
  let max = 50000

  for (const arg of args) {
    if (arg.startsWith('--max=')) {
      max = parseInt(arg.split('=')[1], 10)
    }
  }

  console.log(`Auditing URL explosion in slice sitemaps...`)
  console.log(`Base: ${SITEMAP_URL}`)
  console.log(`Max Allowed Slices: ${max}`)

  let sitemapIndex = ''
  try {
    sitemapIndex = await fetchSitemap(SITEMAP_URL)
  } catch (err: any) {
    console.error(err.message)
    process.exit(1)
  }

  if (!sitemapIndex) {
    console.log('No slice sitemaps found (404). This is valid if no slices meet indexable thresholds.')
    process.exit(0)
  }

  const shardUrls = extractLocs(sitemapIndex)
  console.log(`Found ${shardUrls.length} slice shard(s).`)

  let totalSlices = 0

  for (const shardUrl of shardUrls) {
    process.stdout.write(`Fetching shard: ${shardUrl} ... `)
    const xml = await fetchSitemap(shardUrl)
    const locs = extractLocs(xml)
    totalSlices += locs.length
    console.log(`${locs.length} entries`)
  }

  console.log(`\nTotal generated slice URLs: ${totalSlices}`)

  if (totalSlices > max) {
    console.error(`\n❌ ERROR: URL explosion detected! Total slices (${totalSlices}) exceeds maximum (${max}).`)
    process.exit(1)
  }

  console.log(`\n✅ PASS: Slice generation is within budget.`)
  process.exit(0)
}

run()
