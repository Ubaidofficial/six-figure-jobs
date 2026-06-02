import * as cheerio from 'cheerio'

const SITEMAP_URL = process.env.SEO_BASE_URL
  ? `${process.env.SEO_BASE_URL}/sitemap-jobs.xml`
  : 'http://localhost:3000/sitemap-jobs.xml'

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

async function validateJobPage(url: string): Promise<string[]> {
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

    // Validate required fields
    if (!jobPosting.title) errors.push('Missing title')
    if (!jobPosting.description) errors.push('Missing description')
    if (!jobPosting.datePosted) errors.push('Missing datePosted')
    if (!jobPosting.validThrough) errors.push('Missing validThrough')
    
    if (!jobPosting.hiringOrganization || !jobPosting.hiringOrganization.name) {
      errors.push('Missing hiringOrganization.name')
    }

    // Check baseSalary logic
    if (jobPosting.baseSalary) {
      if (!jobPosting.baseSalary.value || !jobPosting.baseSalary.value.minValue) {
        errors.push('baseSalary present but missing value/minValue')
      }
    }

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
  
  try {
    urls = await fetchUrlsFromSitemap(SITEMAP_URL)
  } catch (err: any) {
    console.error(err.message)
    process.exit(1)
  }

  if (urls.length === 0) {
    console.error('No URLs found in sitemap.')
    process.exit(1)
  }

  // Shuffle and pick N samples
  const shuffled = urls.sort(() => 0.5 - Math.random())
  const samples = shuffled.slice(0, Math.min(sampleSize, urls.length))

  console.log(`Validating ${samples.length} sampled job URLs...`)
  
  let failed = 0

  for (const url of samples) {
    process.stdout.write(`- ${url} ... `)
    const errors = await validateJobPage(url)
    if (errors.length > 0) {
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

  console.log(`\nAll ${samples.length} jobs passed schema validation.`)
  process.exit(0)
}

run()
