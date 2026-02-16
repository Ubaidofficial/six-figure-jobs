#!/usr/bin/env node
/* global console, process, URL, AbortController, setTimeout, clearTimeout, fetch */
// Simple, dependency-free sitemap health check.
// - Fetches robots.txt for sitemap list
// - Validates sitemap XML responses
// - Samples URLs and checks for non-200/redirects

const SITE_URL = process.env.SITE_URL || 'https://www.6figjobs.com'
const ROBOTS_URL = new URL('/robots.txt', SITE_URL).toString()

const CHILD_SITEMAP_SAMPLE = toInt(process.env.CHILD_SITEMAP_SAMPLE, 3)
const JOB_URL_SAMPLE = toInt(process.env.JOB_URL_SAMPLE, 20)
const GENERAL_URL_SAMPLE = toInt(process.env.GENERAL_URL_SAMPLE, 5)
const MAX_BAD_URLS = toInt(process.env.MAX_BAD_URLS, 2)
const REQUEST_TIMEOUT_MS = toInt(process.env.REQUEST_TIMEOUT_MS, 15000)
const CONCURRENCY = toInt(process.env.CONCURRENCY, 5)
const MAX_DEPTH = toInt(process.env.MAX_SITEMAP_DEPTH, 2)

function toInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function extractSitemapsFromRobots(txt) {
  return txt
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.toLowerCase().startsWith('sitemap:'))
    .map((line) => line.slice('sitemap:'.length).trim())
}

function decodeXmlEntities(input) {
  return String(input || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function extractLocs(xml) {
  const locs = []
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi
  let match
  while ((match = re.exec(xml)) !== null) {
    locs.push(decodeXmlEntities(match[1]).trim())
  }
  return locs
}

function detectSitemapType(xml) {
  if (/<sitemapindex\b/i.test(xml)) return 'index'
  if (/<urlset\b/i.test(xml)) return 'urlset'
  return 'unknown'
}

function sampleArray(list, n) {
  if (!Array.isArray(list) || list.length === 0) return []
  if (list.length <= n) return list.slice()
  const out = []
  const step = list.length / n
  for (let i = 0; i < n; i += 1) {
    out.push(list[Math.floor(i * step)])
  }
  return Array.from(new Set(out))
}

function isLikelyJobSitemap(url) {
  return /\/sitemap-jobs(\b|\/)/i.test(url)
}

async function fetchText(url, { expectXml } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SitemapHealthCheck/1.0',
        Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location') || ''
      throw new Error(`Redirect ${res.status} ${location}`)
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const contentType = res.headers.get('content-type') || ''
    if (expectXml && !/xml|text\/plain/i.test(contentType)) {
      throw new Error(`Unexpected content-type ${contentType}`)
    }
    const body = await res.text()
    return { body, contentType }
  } finally {
    clearTimeout(timeout)
  }
}

async function mapLimit(items, limit, fn) {
  const results = []
  let index = 0

  async function worker() {
    while (index < items.length) {
      const i = index
      index += 1
      results[i] = await fn(items[i], i)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

async function checkUrls(urls, { maxBad, label }) {
  const unique = Array.from(new Set(urls)).filter(Boolean)
  let bad = 0
  let ok = 0

  await mapLimit(unique, CONCURRENCY, async (url) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'SitemapHealthCheck/1.0' },
      })

      if (res.status >= 500) {
        throw new Error(`${label} url 5xx ${res.status} ${url}`)
      }
      if (res.status >= 300 && res.status < 400) {
        bad += 1
        console.warn(`WARN ${label} url redirect ${res.status} ${url}`)
        return
      }
      if (res.status !== 200) {
        bad += 1
        console.warn(`WARN ${label} url status ${res.status} ${url}`)
        return
      }
      ok += 1
    } finally {
      clearTimeout(timeout)
    }
  })

  console.log(`Checked ${unique.length} ${label} URLs: ok=${ok} bad=${bad}`)
  if (bad > maxBad) {
    throw new Error(`Too many bad ${label} URLs (${bad} > ${maxBad})`)
  }
}

async function checkSitemap(url, depth = 0) {
  if (depth > MAX_DEPTH) {
    throw new Error(`Max sitemap depth exceeded at ${url}`)
  }

  const indent = '  '.repeat(depth)
  console.log(`${indent}Checking sitemap: ${url}`)
  const { body } = await fetchText(url, { expectXml: true })
  const type = detectSitemapType(body)

  if (type === 'unknown') {
    throw new Error(`Unknown sitemap type for ${url}`)
  }

  const locs = extractLocs(body)
  if (locs.length === 0) {
    throw new Error(`No <loc> entries found in ${url}`)
  }

  if (type === 'index') {
    const childResults = await mapLimit(locs, CONCURRENCY, async (childUrl) => {
      try {
        const { body: childBody } = await fetchText(childUrl, { expectXml: true })
        const childType = detectSitemapType(childBody)
        if (childType === 'unknown') {
          return { url: childUrl, error: 'Unknown sitemap type' }
        }

        const childLocs = extractLocs(childBody)
        if (childLocs.length === 0) {
          return { url: childUrl, error: 'No <loc> entries found' }
        }

        return { url: childUrl, error: null }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { url: childUrl, error: msg }
      }
    })

    const childErrors = childResults.filter((row) => row.error)
    if (childErrors.length > 0) {
      const preview = childErrors
        .slice(0, 5)
        .map((row) => `${row.url} (${row.error})`)
        .join('; ')
      const suffix =
        childErrors.length > 5 ? `; ...and ${childErrors.length - 5} more` : ''
      throw new Error(`Index references invalid child sitemap(s): ${preview}${suffix}`)
    }

    const sample = sampleArray(locs, CHILD_SITEMAP_SAMPLE)
    console.log(`${indent}Index entries: ${locs.length} (sampling ${sample.length})`)
    for (const child of sample) {
      await checkSitemap(child, depth + 1)
    }
    return
  }

  // urlset
  const isJobs = isLikelyJobSitemap(url)
  const sampleCount = isJobs ? JOB_URL_SAMPLE : GENERAL_URL_SAMPLE
  const sampleUrls = sampleArray(locs, sampleCount)
  console.log(
    `${indent}URL entries: ${locs.length} (sampling ${sampleUrls.length})`,
  )
  await checkUrls(sampleUrls, {
    maxBad: isJobs ? MAX_BAD_URLS : 1,
    label: isJobs ? 'job' : 'page',
  })
}

async function main() {
  console.log(`Sitemap health check for ${SITE_URL}`)

  const { body: robotsTxt } = await fetchText(ROBOTS_URL, { expectXml: false })
  const sitemapUrls = extractSitemapsFromRobots(robotsTxt)

  if (sitemapUrls.length === 0) {
    throw new Error(`No sitemaps found in robots.txt at ${ROBOTS_URL}`)
  }

  console.log(`Found ${sitemapUrls.length} sitemaps in robots.txt`)
  const errors = []

  for (const sitemapUrl of sitemapUrls) {
    try {
      await checkSitemap(sitemapUrl, 0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`ERROR ${sitemapUrl}: ${msg}`)
      errors.push(`${sitemapUrl}: ${msg}`)
    }
  }

  if (errors.length > 0) {
    console.error(`\nSitemap health check failed (${errors.length} errors):`)
    for (const msg of errors) console.error(`- ${msg}`)
    process.exit(1)
  }

  console.log('\nSitemap health check passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
