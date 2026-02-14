import process from 'process'

type SitemapBucket = {
  sitemapUrl: string
  sitemapSource: string
  urls: string[]
}

type PageType =
  | 'job'
  | 'company'
  | 'role_hub'
  | 'slice'
  | 'city_country'
  | 'remote'
  | 'salary'
  | 'other'

type AuditRow = {
  pageType: PageType
  url: string
  status: number
  redirected: boolean
  redirectTarget: string | null
  canonical: string | null
  canonicalMatch: boolean
  robotsMeta: string | null
  robotsHeader: string | null
  noindex: boolean
  title: string | null
  h1: string | null
  wordCount: number
  jobPostingSchema: boolean
  issues: string[]
}

const BASE_URL = (process.env.SEO_BASE_URL || 'https://www.6figjobs.com').replace(/\/+$/, '')
const ROOT_SITEMAP_URL = (process.env.SEO_SITEMAP_URL || `${BASE_URL}/sitemap.xml`).trim()
const SAMPLE_TOTAL = Math.max(1, Number(process.env.SEO_TEMPLATE_SAMPLE_TOTAL || '20'))
const TIMEOUT_MS = Math.max(1000, Number(process.env.SEO_TIMEOUT_MS || '60000'))

const TARGET_PAGE_TYPES: PageType[] = [
  'job',
  'company',
  'role_hub',
  'slice',
  'city_country',
  'remote',
  'salary',
]

const SITEMAP_ROUTE_HINTS: Array<{ pattern: RegExp; source: string }> = [
  { pattern: /^\/sitemap\.xml$/i, source: 'app/sitemap.xml/route.ts:21' },
  { pattern: /^\/sitemap-jobs\.xml$/i, source: 'app/sitemap-jobs.xml/route.ts:46' },
  { pattern: /^\/sitemap-jobs\/[^/]+$/i, source: 'app/sitemap-jobs/[page]/route.ts:62' },
  { pattern: /^\/sitemap-company\.xml$/i, source: 'app/sitemap-company.xml/route.ts:50' },
  { pattern: /^\/sitemap-company\/[^/]+$/i, source: 'app/sitemap-company/[page]/route.ts:61' },
  { pattern: /^\/sitemap-city\.xml$/i, source: 'app/sitemap-city.xml/route.ts:16' },
  { pattern: /^\/sitemap-remote\.xml$/i, source: 'app/sitemap-remote.xml/route.ts:36' },
  { pattern: /^\/sitemap-salary\.xml$/i, source: 'app/sitemap-salary.xml/route.ts:10' },
  { pattern: /^\/sitemap-country\.xml$/i, source: 'app/sitemap-country.xml/route.ts:10' },
  { pattern: /^\/sitemap-category\.xml$/i, source: 'app/sitemap-category.xml/route.ts:9' },
  { pattern: /^\/sitemap-level\.xml$/i, source: 'app/sitemap-level.xml/route.ts:9' },
  { pattern: /^\/sitemap-browse\.xml$/i, source: 'app/sitemap-browse.xml/route.ts:23' },
  { pattern: /^\/sitemap-slices\.xml$/i, source: 'app/sitemap-slices.xml/route.ts:12' },
  { pattern: /^\/sitemap-slices\/priority$/i, source: 'app/sitemap-slices/priority/route.ts:48' },
  { pattern: /^\/sitemap-slices\/longtail$/i, source: 'app/sitemap-slices/longtail/route.ts:49' },
]

function inferSitemapSource(sitemapUrl: string): string {
  try {
    const pathname = new URL(sitemapUrl).pathname
    const hit = SITEMAP_ROUTE_HINTS.find((row) => row.pattern.test(pathname))
    return hit?.source || 'unknown_sitemap_source'
  } catch {
    return 'unknown_sitemap_source'
  }
}

function normalizeComparableUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.host}${path}${u.search}`
  } catch {
    return String(url || '').trim()
  }
}

function parseLocs(xml: string): string[] {
  const out: string[] = []
  const re = /<loc>([^<]+)<\/loc>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(xml)) !== null) {
    const loc = String(match[1] || '').trim()
    if (loc) out.push(loc)
  }
  return out
}

function detectSitemapType(xml: string): 'index' | 'urlset' | 'unknown' {
  if (/<sitemapindex\b/i.test(xml)) return 'index'
  if (/<urlset\b/i.test(xml)) return 'urlset'
  return 'unknown'
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'seo-template-sanity/1.0',
        accept: 'application/xml,text/xml,text/html;q=0.9,*/*;q=0.8',
      },
    })

    if (!res.ok) {
      throw new Error(`status=${res.status}`)
    }

    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchManual(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'seo-template-sanity/1.0',
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchFollow(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'seo-template-sanity/1.0',
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

function hasNoindexDirective(raw: string | null | undefined): boolean {
  return /\bnoindex\b/i.test(String(raw || ''))
}

function extractCanonical(html: string, pageUrl: string): string | null {
  const m = html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i)
  if (!m?.[0]) return null
  const hrefMatch = m[0].match(/href=["']([^"']+)["']/i)
  if (!hrefMatch?.[1]) return null
  try {
    return new URL(hrefMatch[1], pageUrl).toString()
  } catch {
    return null
  }
}

function extractMetaRobots(html: string): string | null {
  const m = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i)
  return m?.[1] ? String(m[1]).trim() : null
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m?.[1] ? m[1].replace(/\s+/g, ' ').trim() : null
}

function extractH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!m?.[1]) return null
  return m[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null
}

function countWords(html: string): number {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return 0
  return text.split(' ').filter(Boolean).length
}

function hasJobPostingSchema(html: string): boolean {
  return /"@type"\s*:\s*"JobPosting"/i.test(html) || /"@type"\s*:\s*\[[^\]]*"JobPosting"/i.test(html)
}

function classifyPageType(url: string): PageType {
  let path = ''
  try {
    path = new URL(url).pathname.toLowerCase().replace(/\/+$/, '') || '/'
  } catch {
    return 'other'
  }

  if (/^\/job\/[^/]+$/.test(path)) return 'job'
  if (/^\/company\/[^/]+$/.test(path)) return 'company'
  if (/^\/remote\/[^/]+(?:\/[^/]+)?(?:\/[^/]+)?$/.test(path)) return 'remote'
  if (/^\/salary(?:\/|$)/.test(path)) return 'salary'
  if (/^\/jobs\/(100k-plus|200k-plus|300k-plus|400k-plus)$/.test(path)) return 'salary'
  if (/^\/jobs\/(city|country)\/[^/]+$/.test(path)) return 'city_country'

  const roleHubReserved = new Set([
    'city',
    'country',
    'category',
    'level',
    'skills',
    'industry',
    'state',
    'location',
    'remote',
    '100k-plus',
    '200k-plus',
    '300k-plus',
    '400k-plus',
  ])

  const roleHubMatch = path.match(/^\/jobs\/([^/]+)$/)
  if (roleHubMatch && !roleHubReserved.has(roleHubMatch[1])) {
    return 'role_hub'
  }

  if (/^\/jobs\/.+\/(100k-plus|200k-plus|300k-plus|400k-plus)$/.test(path)) return 'slice'
  if (/^\/jobs\/(category|level|skills|industry|state)\//.test(path)) return 'slice'
  if (/^\/jobs\/.+/.test(path)) return 'slice'

  return 'other'
}

async function collectSitemapBuckets(rootUrl: string): Promise<SitemapBucket[]> {
  const seen = new Set<string>()
  const buckets: SitemapBucket[] = []

  async function walk(url: string): Promise<void> {
    if (seen.has(url)) return
    seen.add(url)
    console.log(`[seo:sample] loading sitemap: ${url}`)

    const xml = await fetchText(url)
    const kind = detectSitemapType(xml)
    const locs = parseLocs(xml)

    if (kind === 'index') {
      for (const loc of locs) {
        await walk(loc)
      }
      return
    }

    if (kind === 'urlset') {
      buckets.push({
        sitemapUrl: url,
        sitemapSource: inferSitemapSource(url),
        urls: locs,
      })
      return
    }

    throw new Error(`unknown sitemap XML format at ${url}`)
  }

  await walk(rootUrl)
  return buckets
}

function buildSampleUrls(buckets: SitemapBucket[], sampleTotal: number): string[] {
  const all = Array.from(new Set(buckets.flatMap((b) => b.urls))).sort()
  const byType = new Map<PageType, string[]>()

  for (const url of all) {
    const type = classifyPageType(url)
    const rows = byType.get(type) || []
    rows.push(url)
    byType.set(type, rows)
  }

  const selected: string[] = []
  const seen = new Set<string>()
  const add = (url: string | undefined) => {
    if (!url) return
    if (seen.has(url)) return
    seen.add(url)
    selected.push(url)
  }

  for (const type of TARGET_PAGE_TYPES) {
    add(byType.get(type)?.[0])
  }

  let pointer = 1
  while (selected.length < sampleTotal) {
    let progressed = false
    for (const type of TARGET_PAGE_TYPES) {
      const list = byType.get(type) || []
      add(list[pointer])
      if (list[pointer] && selected[selected.length - 1] === list[pointer]) {
        progressed = true
      }
      if (selected.length >= sampleTotal) break
    }
    pointer += 1
    if (!progressed) break
  }

  if (selected.length < sampleTotal) {
    for (const url of all) {
      add(url)
      if (selected.length >= sampleTotal) break
    }
  }

  return selected.slice(0, sampleTotal)
}

async function auditUrl(url: string): Promise<AuditRow> {
  const pageType = classifyPageType(url)

  let head = await fetchManual(url, 'HEAD')
  if (head.status === 405 || head.status === 501) {
    head = await fetchManual(url, 'GET')
  }

  const redirected = head.status >= 300 && head.status < 400
  const redirectTarget = redirected ? head.headers.get('location') : null

  const robotsHeader = head.headers.get('x-robots-tag')
  const follow = await fetchFollow(url)
  const html = await follow.text()
  const canonical = extractCanonical(html, follow.url || url)
  const robotsMeta = extractMetaRobots(html)
  const noindex = hasNoindexDirective(robotsHeader) || hasNoindexDirective(robotsMeta)
  const normalizedInput = normalizeComparableUrl(url)
  const normalizedCanonical = canonical ? normalizeComparableUrl(canonical) : null
  const canonicalMatch = Boolean(normalizedCanonical && normalizedCanonical === normalizedInput)
  const title = extractTitle(html)
  const h1 = extractH1(html)
  const wordCount = countWords(html)
  const jobPostingSchema = hasJobPostingSchema(html)

  const issues: string[] = []
  if (redirected) issues.push(`redirect:${head.status}`)
  if (follow.status !== 200) issues.push(`non_200:${follow.status}`)
  if (noindex) issues.push('robots_noindex')
  if (!canonical) issues.push('canonical_missing')
  else if (!canonicalMatch) issues.push('canonical_mismatch')
  if (!title) issues.push('title_missing')
  if (!h1) issues.push('h1_missing')
  if (wordCount < 120) issues.push(`thin_content:${wordCount}`)
  if (pageType === 'job' && !jobPostingSchema) issues.push('jobposting_schema_missing')

  return {
    pageType,
    url,
    status: follow.status,
    redirected,
    redirectTarget,
    canonical,
    canonicalMatch,
    robotsMeta,
    robotsHeader,
    noindex,
    title,
    h1,
    wordCount,
    jobPostingSchema,
    issues,
  }
}

async function main() {
  console.log('[seo:sample] starting')
  console.log(`[seo:sample] root sitemap: ${ROOT_SITEMAP_URL}`)
  console.log(`[seo:sample] base url: ${BASE_URL}`)
  console.log(`[seo:sample] sample total: ${SAMPLE_TOTAL}`)

  const buckets = await collectSitemapBuckets(ROOT_SITEMAP_URL)
  const sampleUrls = buildSampleUrls(buckets, SAMPLE_TOTAL)
  console.log(`[seo:sample] discovered sitemaps: ${buckets.length}`)
  console.log(`[seo:sample] sample urls selected: ${sampleUrls.length}`)

  const rows: AuditRow[] = []
  for (const url of sampleUrls) {
    const row = await auditUrl(url)
    rows.push(row)
  }

  const byType = new Map<PageType, number>()
  for (const row of rows) {
    byType.set(row.pageType, (byType.get(row.pageType) || 0) + 1)
  }

  console.log('\n[seo:sample] sampled by page type:')
  for (const type of TARGET_PAGE_TYPES) {
    console.log(`  - ${type}: ${byType.get(type) || 0}`)
  }
  console.log(`  - other: ${byType.get('other') || 0}`)

  console.log('\n[seo:sample] row details:')
  for (const row of rows) {
    const issueText = row.issues.length > 0 ? row.issues.join(',') : 'none'
    console.log(
      `  • type=${row.pageType} status=${row.status} noindex=${row.noindex ? '1' : '0'} canonical_match=${row.canonicalMatch ? '1' : '0'} words=${row.wordCount} jobposting=${row.jobPostingSchema ? '1' : '0'} url=${row.url} title=${JSON.stringify(row.title)} h1=${JSON.stringify(row.h1)} issues=${issueText}`,
    )
  }

  const criticalIssues = rows.flatMap((row) =>
    row.issues
      .filter((issue) =>
        issue.startsWith('redirect') ||
        issue.startsWith('non_200') ||
        issue === 'robots_noindex' ||
        issue === 'canonical_missing' ||
        issue === 'canonical_mismatch' ||
        issue === 'jobposting_schema_missing',
      )
      .map((issue) => `${issue} ${row.url}`),
  )

  const thinContentWarnings = rows
    .flatMap((row) =>
      row.issues
        .filter((issue) => issue.startsWith('thin_content:'))
        .map((issue) => `${issue} ${row.url}`),
    )

  console.log(`\n[seo:sample] critical issues: ${criticalIssues.length}`)
  if (criticalIssues.length > 0) {
    for (const issue of criticalIssues) {
      console.log(`  - ${issue}`)
    }
  }

  console.log(`[seo:sample] thin-content warnings: ${thinContentWarnings.length}`)
  if (thinContentWarnings.length > 0) {
    for (const warning of thinContentWarnings.slice(0, 20)) {
      console.log(`  - ${warning}`)
    }
    if (thinContentWarnings.length > 20) {
      console.log(`  - ...and ${thinContentWarnings.length - 20} more`)
    }
  }

  if (criticalIssues.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('[seo:sample] fatal error:', error)
  process.exit(1)
})
