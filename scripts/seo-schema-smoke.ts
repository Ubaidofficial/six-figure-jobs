import * as cheerio from 'cheerio/slim'

import { validateJobPostingEligibility } from '../lib/seo/jobPostingEligibility'

const BASE_URL = process.env.SEO_BASE_URL || 'http://localhost:3000'
const SITEMAP_URL = `${BASE_URL}/sitemap-jobs.xml`

async function fetchUrlsFromSitemap(url: string): Promise<string[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch sitemap ${url}: ${res.statusText}`)
  const text = await res.text()
  
  const urls: string[] = []
  
  // If it's a sitemap index, fetch the first child sitemap
  if (text.includes('<sitemapindex')) {
    const sitemaps = [...text.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1])
    if (sitemaps.length > 0) {
      return fetchUrlsFromSitemap(sitemaps[0])
    }
    return urls
  }

  // It's a urlset
  const matches = [...text.matchAll(/<loc>(.*?)<\/loc>/g)]
  for (const match of matches) {
    urls.push(match[1])
  }
  return urls
}

/**
 * In indexing phase 1 sitemap-jobs.xml is an empty <urlset> (lib/seo/indexingPhase.ts), so the sample comes from the
 * job links on the listing pages instead.
 */
async function fetchUrlsFromListings(): Promise<string[]> {
  const urls = new Set<string>()
  for (const path of ['/jobs', '/remote']) {
    const res = await fetch(`${BASE_URL}${path}`)
    if (!res.ok) throw new Error(`Failed to fetch ${BASE_URL}${path}: ${res.status}`)
    for (const match of (await res.text()).matchAll(/href="(\/job\/[^"?#]+)"/g)) urls.add(`${BASE_URL}${match[1]}`)
  }
  return [...urls]
}

/** Returns the errors, or null for a noindex page when `skipNoindex` (a listed job we do not offer to Google). */
async function validateJobPage(url: string, skipNoindex = false): Promise<string[] | null> {
  const errors: string[] = []
  
  try {
    const res = await fetch(url)
    if (res.status !== 200) {
      errors.push(`HTTP ${res.status}`)
      return errors
    }

    const html = await res.text()
    const $ = cheerio.load(html)
    
    // Check noindex
    const robots = $('meta[name="robots"]').attr('content')
    if (robots && robots.includes('noindex')) {
      if (skipNoindex) return null
      errors.push('Page has noindex')
    }

    // Check canonical
    const canonical = $('link[rel="canonical"]').attr('href')
    if (!canonical || canonical !== url) {
      errors.push(`Canonical mismatch: expected ${url}, got ${canonical}`)
    }

    // Find JSON-LD
    const jsonLdScripts = $('script[type="application/ld+json"]')
    let jobPosting: any = null

    jsonLdScripts.each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}')
        if (data['@type'] === 'JobPosting') {
          jobPosting = data
        }
      } catch (e) {
        // Ignore parse errors on non-JobPosting scripts
      }
    })

    if (!jobPosting) {
      errors.push('Missing JobPosting JSON-LD')
      return errors
    }

    // Validate Google Jobs eligibility (shared rules — also gated per-PR by
    // __tests__/seo/jobPostingEligibility.test.ts).
    errors.push(...validateJobPostingEligibility(jobPosting))

  } catch (err: any) {
    errors.push(`Error fetching/parsing: ${err.message}`)
  }

  return errors
}

async function run() {
  const args = process.argv.slice(2)
  let sampleSize = 10
  
  for (const arg of args) {
    if (arg.startsWith('--samples=')) {
      sampleSize = parseInt(arg.split('=')[1], 10)
    }
  }

  console.log(`Fetching jobs sitemap: ${SITEMAP_URL}`)
  let urls: string[] = []
  let fromListings = false

  try {
    urls = await fetchUrlsFromSitemap(SITEMAP_URL)
    if (urls.length === 0) {
      console.log('No URLs in the jobs sitemap (indexing phase 1); sampling job links from /jobs and /remote.')
      urls = await fetchUrlsFromListings()
      fromListings = true
    }
  } catch (err: any) {
    console.error(err.message)
    process.exit(1)
  }

  if (urls.length === 0) {
    console.error('No job URLs found.')
    process.exit(1)
  }

  // Shuffle and pick N samples
  const shuffled = urls.sort(() => 0.5 - Math.random())
  const samples = shuffled.slice(0, Math.min(sampleSize, urls.length))

  console.log(`Validating ${samples.length} sampled job URLs...`)
  
  let failed = 0
  let skipped = 0

  for (const url of samples) {
    process.stdout.write(`- ${url} ... `)
    const errors = await validateJobPage(url, fromListings)
    if (errors === null) {
      console.log('skipped (noindex: not offered to Google)')
      skipped++
    } else if (errors.length > 0) {
      console.log(`❌ FAIL\n    ${errors.join('\n    ')}`)
      failed++
    } else {
      console.log(`✅ PASS`)
    }
  }

  if (failed > 0) {
    console.error(`\nFailed ${failed}/${samples.length} validations.`)
    process.exit(1)
  }

  if (skipped === samples.length) {
    console.error('\nEvery sampled job page is noindex; nothing was validated.')
    process.exit(1)
  }

  console.log(`\nAll ${samples.length - skipped} indexable jobs passed schema validation${skipped ? ` (${skipped} noindex skipped)` : ''}.`)
  process.exit(0)
}

run()
