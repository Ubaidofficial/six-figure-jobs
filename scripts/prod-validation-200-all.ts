import * as cheerio from 'cheerio'

const PROD_URL = 'https://www.6figjobs.com'
const HEADERS = {
  'user-agent': 'seo-validator-bot/2.1',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

async function fetchText(url: string) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`)
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

async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(url, { method: 'GET', redirect: 'manual', headers: HEADERS, signal: controller.signal })
      clearTimeout(timer)
      
      // Retry on 5xx or 429
      if (res.status >= 500 || res.status === 429) {
        if (i === retries) return res
        throw new Error(`Transient HTTP ${res.status}`)
      }
      return res
    } catch (e: any) {
      if (i === retries) {
        throw e
      }
      // Exponential backoff: 1s, 2s, 4s...
      const delay = 1000 * Math.pow(2, i)
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

function getRandomSample(arr: string[], n: number): string[] {
  if (n >= arr.length) return arr
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, n)
}

async function main() {
  console.log('--- A) Sitemap Integrity ---')
  const rootLocs = await getSitemapLocs(`${PROD_URL}/sitemap.xml`)
  console.log(`Discovered ${rootLocs.length} child sitemaps in sitemap.xml:\n  ${rootLocs.join('\n  ')}`)
  
  const results: Record<string, any> = {}
  let allJobLocs: string[] = []

  for (const sitemap of rootLocs) {
    let locs = await getSitemapLocs(sitemap)
    let aggregatedLocs: string[] = []
    
    // Check if it's an index by inspecting the first element
    if (locs[0] && (locs[0].endsWith('.xml') || locs[0].match(/\/[0-9]+$/) || locs[0].match(/\/priority$/) || locs[0].match(/\/longtail$/))) {
       console.log(`\n${sitemap} is an index, fetching ALL child chunks...`)
       for (const chunkUrl of locs) {
          const chunkLocs = await getSitemapLocs(chunkUrl)
          aggregatedLocs.push(...chunkLocs)
       }
    } else {
       aggregatedLocs = locs
    }
    
    if (sitemap.includes('sitemap-jobs')) {
       allJobLocs = aggregatedLocs
    }
    
    // Pick a random sample across all shards
    const sample = getRandomSample(aggregatedLocs, 200)
    console.log(`Validating ${sample.length} random HTML URLs from ${sitemap} (out of ${aggregatedLocs.length} total) ...`)
    
    let redirects = 0, non200 = 0, noindex = 0, missingCanonical = 0, mismatchCanonical = 0
    let failures: string[] = []

    const batches = []
    for(let i=0; i<sample.length; i+=10) {
      batches.push(sample.slice(i, i+10))
    }
    
    for (const batch of batches) {
       await Promise.all(batch.map(async (url) => {
         try {
           const res = await fetchWithRetry(url)
           if (!res) return
           if (res.status >= 300 && res.status < 400) { redirects++; failures.push(`Redirect: ${url}`); return }
           if (res.status !== 200) { non200++; failures.push(`Non-200 (${res.status}): ${url}`); return }
           
           const robotsHeader = res.headers.get('x-robots-tag')
           if (robotsHeader && robotsHeader.toLowerCase().includes('noindex')) { noindex++; failures.push(`Noindex (header): ${url}`); return }
           
           const html = await res.text()
           const $ = cheerio.load(html)
           const robotsMeta = $('meta[name="robots"]').attr('content')
           if (robotsMeta && robotsMeta.toLowerCase().includes('noindex')) { noindex++; failures.push(`Noindex (meta): ${url}`); return }
           
           const canonical = $('link[rel="canonical"]').attr('href')
           if (!canonical) { missingCanonical++; failures.push(`Missing canonical: ${url}`); return }
           if (canonical !== url) { mismatchCanonical++; failures.push(`Mismatch canonical: ${url} (got ${canonical})`); }
         } catch (e: any) {
           non200++; failures.push(`Fetch failed: ${url} - ${e.message}`)
         }
       }))
    }
    results[sitemap] = { redirects, non200, noindex, missingCanonical, mismatchCanonical, failures }
    console.log(`  -> Redirects: ${redirects}, Non-200: ${non200}, Noindex: ${noindex}, Canonical Missing: ${missingCanonical}, Canonical Mismatch: ${mismatchCanonical}`)
  }

  console.log('\n--- B) Google Jobs Schema & C) LLM Extractability ---')
  const jobs = getRandomSample(allJobLocs, 20)
  
  let schemaPass = 0, extractPass = 0
  let missingFields: Record<string, string[]> = {}
  
  for (const url of jobs) {
    try {
      const res = await fetchWithRetry(url)
      if (!res) continue
      const html = await res.text()
      const $ = cheerio.load(html)
      
      let hasSchema = false
      const scripts = $('script[type="application/ld+json"]').toArray()
      for (const el of scripts) {
        const content = $(el).html()
        if (content && content.includes('"JobPosting"')) {
           const data = JSON.parse(content)
           const missing = []
           if (!data.title) missing.push('title')
           if (!data.description) missing.push('description')
           if (!data.datePosted) missing.push('datePosted')
           if (!data.hiringOrganization) missing.push('hiringOrganization')
           if (!data.url) missing.push('url')
           
           if (missing.length === 0) hasSchema = true
           else missingFields[url] = missing
        }
      }
      if (hasSchema) schemaPass++
      
      const title = $('h1').first().text().trim()
      const contentText = $('body').text()
      const hasApply = $('a').toArray().some(a => $(a).text().toLowerCase().includes('apply'))
      if (title && contentText.length > 200 && hasApply) {
         extractPass++
      }
      
    } catch (e: any) {
      console.log(`Error on ${url}: ${e.message}`)
    }
  }
  console.log(`B) Schema passed: ${schemaPass}/20`)
  if (Object.keys(missingFields).length > 0) console.log(`Missing fields:`, missingFields)
  console.log(`C) Extractability passed: ${extractPass}/20`)
  
}

main().catch(console.error)
