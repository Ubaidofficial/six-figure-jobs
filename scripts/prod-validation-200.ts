import * as cheerio from 'cheerio'

const PROD_URL = 'https://www.6figjobs.com'
const HEADERS = {
  'user-agent': 'seo-validator-bot/1.0',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

async function fetchText(url: string) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return { text: await res.text(), url: res.url, status: res.status }
}

async function getSitemapLocs(url: string): Promise<string[]> {
  try {
    const { text } = await fetchText(url)
    const out: string[] = []
    const re = /<loc>([^<]+)<\/loc>/gi
    let match
    while ((match = re.exec(text)) !== null) {
      if (match[1]) out.push(match[1].trim())
    }
    return out
  } catch (err: any) {
    console.error(`Failed to fetch sitemap ${url}: ${err.message}`)
    return []
  }
}

async function fetchWithRetry(url: string, retries = 2) {
  for (let i=0; i<=retries; i++) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'manual', headers: HEADERS })
      return res
    } catch (e) {
      if (i === retries) throw e
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

async function taskA() {
  console.log('\n--- A) Sitemap Integrity ---')
  
  const targetSitemaps = [
    `${PROD_URL}/sitemap-jobs.xml`,
    `${PROD_URL}/sitemap-slices.xml`
  ]
  
  let totalRedirect = 0
  let totalNon200 = 0
  let totalNoindex = 0
  let totalMissingCanonical = 0
  let totalMismatchCanonical = 0
  
  for (const sitemap of targetSitemaps) {
    let locs = await getSitemapLocs(sitemap)
    if (sitemap === `${PROD_URL}/sitemap-jobs.xml` || sitemap === `${PROD_URL}/sitemap-slices.xml`) {
       if (locs[0] && locs[0].includes(sitemap.replace('.xml', '/'))) {
          console.log(`${sitemap} is an index, fetching first chunk: ${locs[0]}`)
          locs = await getSitemapLocs(locs[0])
       }
    }
    
    const sample = locs.slice(0, 200)
    console.log(`\nValidating ${sample.length} HTML URLs from ${sitemap}...`)
    
    // Batch processing to speed up
    const batches = []
    for(let i=0; i<sample.length; i+=10) {
      batches.push(sample.slice(i, i+10))
    }
    
    for (const batch of batches) {
       await Promise.all(batch.map(async (url) => {
         try {
           const res = await fetchWithRetry(url)
           if (!res) return
           if (res.status >= 300 && res.status < 400) { totalRedirect++; return }
           if (res.status !== 200) { totalNon200++; return }
           const html = await res.text()
           const $ = cheerio.load(html)
           const robots = $('meta[name="robots"]').attr('content')
           if (robots && robots.toLowerCase().includes('noindex')) { totalNoindex++; return }
           const canonical = $('link[rel="canonical"]').attr('href')
           if (!canonical) { totalMissingCanonical++; return }
           if (canonical !== url) { totalMismatchCanonical++; }
         } catch {
          /* ignore */
        }
       }))
    }
  }
  console.log(`Counts -> Redirects: ${totalRedirect}, Non-200: ${totalNon200}, Noindex: ${totalNoindex}, Canonical Missing: ${totalMissingCanonical}, Canonical Mismatch: ${totalMismatchCanonical}`)
}

async function main() {
  await taskA()
}

main().catch(console.error)
