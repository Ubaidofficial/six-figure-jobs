// scripts/classify-gsc-urls.ts
// Classify GSC URLs with live HTTP + canonical/noindex + DB evidence.

import { promises as fs } from 'node:fs'

import { prisma } from '../lib/prisma'
import { parseJobSlugParam } from '../lib/jobs/jobSlug'
import { isCanonicalSlug, isTier1Role } from '../lib/roles/canonicalSlugs'

type JobLookup = {
  id: string
  shortId: string | null
  externalId: string | null
  title: string
  isExpired: boolean
  updatedAt: Date
}

type UrlRow = {
  url: string
  path: string
  routeOwner: string
  inSitemap: boolean
  headStatus: number | null
  finalStatus: number | null
  redirectLocation: string | null
  finalUrl: string | null
  canonical: string | null
  canonicalSelf: boolean
  metaNoindex: boolean
  xRobotsNoindex: boolean
  roleSlug: string | null
  roleCanonical: boolean | null
  roleTier1: boolean | null
  shortId: string | null
  dbFound: boolean
  dbExpired: boolean | null
  dbJobId: string | null
  dbTitle: string | null
  className: string
  expected: boolean
  notes: string
  error: string | null
}

type Summary = {
  total: number
  expected: number
  unexpected: number
  classCounts: Array<{ className: string; count: number }>
}

const URL_FILE = process.env.URL_FILE || '.tmp_audit/gsc_urls.txt'
const OUTPUT_JSON =
  process.env.OUTPUT_JSON || '.tmp_audit/gsc-url-classification.json'
const OUTPUT_TSV =
  process.env.OUTPUT_TSV || '.tmp_audit/gsc-url-classification.tsv'
const TIMEOUT_MS = Math.max(2_000, Number(process.env.TIMEOUT_MS || '20000'))
const CONCURRENCY = Math.max(
  1,
  Math.min(24, Number(process.env.CONCURRENCY || '8')),
)

function normalizeComparableUrl(input: string): string {
  try {
    const u = new URL(input)
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.host}${path}${u.search}`
  } catch {
    return String(input || '').trim()
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

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'gsc-url-classifier/1.0',
        accept: 'application/xml,text/xml,text/html;q=0.9,*/*;q=0.8',
      },
    })
    if (!res.ok) throw new Error(`status=${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchManual(url: string, method: 'HEAD' | 'GET') {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'gsc-url-classifier/1.0',
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchFollow(url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'gsc-url-classifier/1.0',
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function buildSitemapUrlSet(origin: string): Promise<Set<string>> {
  const rootSitemap = `${origin}/sitemap.xml`
  const seen = new Set<string>()
  const out = new Set<string>()

  async function walkSitemap(url: string): Promise<void> {
    if (seen.has(url)) return
    seen.add(url)

    const xml = await fetchText(url)
    const locs = parseLocs(xml)

    if (/<sitemapindex\b/i.test(xml)) {
      for (const loc of locs) {
        await walkSitemap(loc)
      }
      return
    }

    if (!/<urlset\b/i.test(xml)) return
    for (const loc of locs) {
      out.add(normalizeComparableUrl(loc))
    }
  }

  await walkSitemap(rootSitemap)
  return out
}

function routeOwnerFromPath(pathname: string): string {
  if (pathname.startsWith('/job/')) return 'app/job/[slug]/page.tsx'
  if (pathname.startsWith('/remote/')) return 'app/remote/[role]/page.tsx'
  if (pathname.startsWith('/jobs/')) return 'app/jobs/_components/page.tsx'
  if (pathname.startsWith('/company/')) return 'app/company/[slug]/page.tsx'
  return 'unknown'
}

function extractRoleSlugFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/remote\/([^/?#]+)/i)
  return m?.[1] ? decodeURIComponent(m[1]).toLowerCase() : null
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

function extractMetaNoindex(html: string): boolean {
  return /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b/i.test(
    html,
  )
}

function hasNoindexDirective(raw: string | null | undefined): boolean {
  return /\bnoindex\b/i.test(String(raw || ''))
}

async function findJobBySlug(urlPath: string): Promise<{
  shortId: string | null
  job: JobLookup | null
}> {
  const slug = decodeURIComponent(urlPath.split('/').pop() || '')
  const parsed = parseJobSlugParam(slug)
  const shortId = parsed.shortId

  const ors: Array<Record<string, string>> = []
  if (parsed.shortId) ors.push({ shortId: parsed.shortId })
  if (parsed.jobId) ors.push({ id: parsed.jobId })
  if (parsed.externalId) ors.push({ externalId: parsed.externalId })

  if (ors.length === 0) {
    return { shortId, job: null }
  }

  const job = (await prisma.job.findFirst({
    where: ors.length === 1 ? ors[0] : { OR: ors },
    select: {
      id: true,
      shortId: true,
      externalId: true,
      title: true,
      isExpired: true,
      updatedAt: true,
    },
  })) as JobLookup | null

  return { shortId, job }
}

function classifyRow(
  row: Omit<UrlRow, 'className' | 'expected' | 'notes'>,
): Pick<UrlRow, 'className' | 'expected' | 'notes'> {
  const {
    headStatus,
    finalStatus,
    redirectLocation,
    metaNoindex,
    xRobotsNoindex,
    canonical,
    canonicalSelf,
    inSitemap,
    path,
    dbFound,
    dbExpired,
    dbTitle,
    roleSlug,
    roleTier1,
    roleCanonical,
  } = row

  if (headStatus != null && headStatus >= 500) {
    return {
      className: 'critical_5xx',
      expected: false,
      notes: 'Server error on HEAD',
    }
  }

  if (headStatus != null && headStatus >= 300 && headStatus < 400) {
    const expected = !inSitemap
    return {
      className: expected
        ? 'expected_redirect_legacy'
        : 'unexpected_redirect_in_sitemap',
      expected,
      notes: `Redirects to ${redirectLocation || 'unknown'}`,
    }
  }

  if (finalStatus === 410) {
    return {
      className: inSitemap ? 'unexpected_410_in_sitemap' : 'expected_410_gone',
      expected: !inSitemap,
      notes: 'Gone response',
    }
  }

  if (finalStatus === 404) {
    if (path.startsWith('/job/')) {
      if (dbFound && dbExpired === true) {
        return {
          className: 'expected_404_expired_job',
          expected: !inSitemap,
          notes: 'Job exists but is expired',
        }
      }

      if (!dbFound) {
        return {
          className: 'expected_404_missing_job',
          expected: !inSitemap,
          notes: 'Job shortId/id no longer in DB',
        }
      }

      return {
        className: 'unexpected_404_active_job',
        expected: false,
        notes: 'Job exists and is not expired but URL returned 404',
      }
    }

    return {
      className: inSitemap ? 'unexpected_404_in_sitemap' : 'expected_404',
      expected: !inSitemap,
      notes: 'Not found',
    }
  }

  if (finalStatus == null) {
    return {
      className: 'check_error',
      expected: false,
      notes: 'Could not resolve final status',
    }
  }

  if (finalStatus >= 500) {
    return {
      className: 'critical_5xx',
      expected: false,
      notes: 'Server error on GET',
    }
  }

  if (finalStatus >= 400) {
    return {
      className: 'unexpected_4xx',
      expected: false,
      notes: `HTTP ${finalStatus}`,
    }
  }

  if (metaNoindex || xRobotsNoindex) {
    if (path.startsWith('/remote/') && roleSlug) {
      if (roleCanonical && roleTier1 === false) {
        return {
          className: 'expected_noindex_tier2_remote',
          expected: !inSitemap,
          notes: 'Tier-2 remote role is noindex by policy',
        }
      }

      if (roleCanonical === false) {
        return {
          className: 'expected_noindex_noncanonical_remote',
          expected: !inSitemap,
          notes: 'Non-canonical role variant',
        }
      }
    }

    if (path.startsWith('/job/')) {
      const title = String(dbTitle || '').toLowerCase()
      const intentionalNoindexTitlePattern =
        /\bintern(ship)?\b|\bjunior\b|\bnew[\s-]?grad(uate)?\b|\bentry\b/

      if (intentionalNoindexTitlePattern.test(title)) {
        return {
          className: 'expected_noindex_job_excluded_title',
          expected: !inSitemap,
          notes: 'Job title matches intentional exclusion policy',
        }
      }

      return {
        className: 'review_noindex_job',
        expected: false,
        notes: 'Job detail page returned noindex',
      }
    }

    return {
      className: inSitemap ? 'unexpected_noindex_in_sitemap' : 'expected_noindex',
      expected: !inSitemap,
      notes: 'Noindex directive present',
    }
  }

  if (!canonical) {
    return {
      className: 'review_canonical_missing',
      expected: false,
      notes: 'No canonical tag found',
    }
  }

  if (!canonicalSelf) {
    return {
      className: 'review_canonical_mismatch',
      expected: false,
      notes: 'Canonical differs from final URL',
    }
  }

  return {
    className: 'ok_200_indexable',
    expected: true,
    notes: inSitemap ? 'Healthy and in sitemap' : 'Healthy URL (not in sitemap)',
  }
}

function toTsv(rows: UrlRow[]): string {
  const header = [
    'url',
    'path',
    'routeOwner',
    'inSitemap',
    'headStatus',
    'finalStatus',
    'redirectLocation',
    'finalUrl',
    'canonical',
    'canonicalSelf',
    'metaNoindex',
    'xRobotsNoindex',
    'roleSlug',
    'roleCanonical',
    'roleTier1',
    'shortId',
    'dbFound',
    'dbExpired',
    'dbJobId',
    'dbTitle',
    'className',
    'expected',
    'notes',
    'error',
  ]

  const lines = rows.map((row) =>
    [
      row.url,
      row.path,
      row.routeOwner,
      row.inSitemap,
      row.headStatus ?? '',
      row.finalStatus ?? '',
      row.redirectLocation ?? '',
      row.finalUrl ?? '',
      row.canonical ?? '',
      row.canonicalSelf,
      row.metaNoindex,
      row.xRobotsNoindex,
      row.roleSlug ?? '',
      row.roleCanonical == null ? '' : row.roleCanonical,
      row.roleTier1 == null ? '' : row.roleTier1,
      row.shortId ?? '',
      row.dbFound,
      row.dbExpired == null ? '' : row.dbExpired,
      row.dbJobId ?? '',
      row.dbTitle ?? '',
      row.className,
      row.expected,
      row.notes,
      row.error ?? '',
    ]
      .map((v) => String(v).replace(/\t/g, ' '))
      .join('\t'),
  )

  return [header.join('\t'), ...lines].join('\n') + '\n'
}

function summarize(rows: UrlRow[]): Summary {
  const classCounts = new Map<string, number>()
  let expected = 0
  let unexpected = 0

  for (const row of rows) {
    classCounts.set(row.className, (classCounts.get(row.className) || 0) + 1)
    if (row.expected) expected += 1
    else unexpected += 1
  }

  return {
    total: rows.length,
    expected,
    unexpected,
    classCounts: Array.from(classCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([className, count]) => ({ className, count })),
  }
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
) {
  if (items.length === 0) return
  let i = 0
  const slots = Math.min(items.length, CONCURRENCY)

  await Promise.all(
    Array.from({ length: slots }, async () => {
      while (true) {
        const idx = i
        i += 1
        if (idx >= items.length) break
        await worker(items[idx])
      }
    }),
  )
}

async function classifySingle(
  rawUrl: string,
  sitemapSet: Set<string>,
): Promise<UrlRow> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    const row: UrlRow = {
      url: rawUrl,
      path: '',
      routeOwner: 'unknown',
      inSitemap: false,
      headStatus: null,
      finalStatus: null,
      redirectLocation: null,
      finalUrl: null,
      canonical: null,
      canonicalSelf: false,
      metaNoindex: false,
      xRobotsNoindex: false,
      roleSlug: null,
      roleCanonical: null,
      roleTier1: null,
      shortId: null,
      dbFound: false,
      dbExpired: null,
      dbJobId: null,
      dbTitle: null,
      className: 'invalid_url',
      expected: false,
      notes: 'Failed to parse URL',
      error: null,
    }
    return row
  }

  const path = parsedUrl.pathname
  const routeOwner = routeOwnerFromPath(path)
  const normalizedInput = normalizeComparableUrl(rawUrl)
  const inSitemap = sitemapSet.has(normalizedInput)

  let headStatus: number | null = null
  let redirectLocation: string | null = null
  let xRobotsNoindex = false
  let finalStatus: number | null = null
  let finalUrl: string | null = null
  let canonical: string | null = null
  let canonicalSelf = false
  let metaNoindex = false
  let error: string | null = null

  let shortId: string | null = null
  let dbFound = false
  let dbExpired: boolean | null = null
  let dbJobId: string | null = null
  let dbTitle: string | null = null

  let roleSlug: string | null = null
  let roleCanonical: boolean | null = null
  let roleTier1: boolean | null = null

  try {
    if (path.startsWith('/remote/')) {
      roleSlug = extractRoleSlugFromPath(path)
      if (roleSlug) {
        roleCanonical = isCanonicalSlug(roleSlug)
        roleTier1 = roleCanonical ? isTier1Role(roleSlug) : false
      }
    }

    if (path.startsWith('/job/')) {
      const lookup = await findJobBySlug(path)
      shortId = lookup.shortId
      if (lookup.job) {
        dbFound = true
        dbExpired = lookup.job.isExpired
        dbJobId = lookup.job.id
        dbTitle = lookup.job.title
      }
    }

    let head = await fetchManual(rawUrl, 'HEAD')
    if (head.status === 405 || head.status === 501) {
      head = await fetchManual(rawUrl, 'GET')
    }

    headStatus = head.status
    redirectLocation = head.headers.get('location')
    xRobotsNoindex = hasNoindexDirective(head.headers.get('x-robots-tag'))

    const get = await fetchFollow(rawUrl)
    finalStatus = get.status
    finalUrl = get.url
    xRobotsNoindex =
      xRobotsNoindex || hasNoindexDirective(get.headers.get('x-robots-tag'))

    const contentType = (get.headers.get('content-type') || '').toLowerCase()
    const isHtml =
      contentType.includes('text/html') ||
      contentType.includes('application/xhtml+xml')
    if (isHtml) {
      const html = await get.text()
      metaNoindex = extractMetaNoindex(html)
      canonical = extractCanonical(html, finalUrl || rawUrl)
      canonicalSelf =
        Boolean(canonical) &&
        normalizeComparableUrl(canonical as string) ===
          normalizeComparableUrl(finalUrl || rawUrl)
    }
  } catch (e: any) {
    error = String(e?.message || e)
  }

  const base: Omit<UrlRow, 'className' | 'expected' | 'notes'> = {
    url: rawUrl,
    path,
    routeOwner,
    inSitemap,
    headStatus,
    finalStatus,
    redirectLocation,
    finalUrl,
    canonical,
    canonicalSelf,
    metaNoindex,
    xRobotsNoindex,
    roleSlug,
    roleCanonical,
    roleTier1,
    shortId,
    dbFound,
    dbExpired,
    dbJobId,
    dbTitle,
    error,
  }

  if (error) {
    return {
      ...base,
      className: 'check_error',
      expected: false,
      notes: 'Failed during URL checks',
    }
  }

  const cls = classifyRow(base)
  return {
    ...base,
    ...cls,
  }
}

async function main() {
  const raw = await fs.readFile(URL_FILE, 'utf8')
  const urls = Array.from(
    new Set(
      raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  )

  if (urls.length === 0) {
    throw new Error(`No URLs found in ${URL_FILE}`)
  }

  const origin = (() => {
    try {
      return new URL(urls[0]).origin
    } catch {
      return 'https://www.6figjobs.com'
    }
  })()

  console.log(`[gsc:classify] urls=${urls.length}`)
  console.log(`[gsc:classify] origin=${origin}`)
  console.log(`[gsc:classify] url_file=${URL_FILE}`)
  console.log(`[gsc:classify] concurrency=${CONCURRENCY} timeoutMs=${TIMEOUT_MS}`)

  const sitemapSet = await buildSitemapUrlSet(origin)
  console.log(`[gsc:classify] sitemapUrls=${sitemapSet.size}`)

  const results: UrlRow[] = new Array(urls.length)
  const indexedUrls = urls.map((url, idx) => ({ url, idx }))
  await runWithConcurrency(indexedUrls, async ({ url, idx }) => {
    results[idx] = await classifySingle(url, sitemapSet)
  })

  const ordered = results.filter(Boolean)
  const summary = summarize(ordered)

  const payload = {
    generatedAt: new Date().toISOString(),
    urlFile: URL_FILE,
    outputJson: OUTPUT_JSON,
    outputTsv: OUTPUT_TSV,
    summary,
    rows: ordered,
  }

  await fs.writeFile(OUTPUT_JSON, JSON.stringify(payload, null, 2), 'utf8')
  await fs.writeFile(OUTPUT_TSV, toTsv(ordered), 'utf8')

  console.log(
    `[gsc:classify] expected=${summary.expected} unexpected=${summary.unexpected} total=${summary.total}`,
  )
  for (const row of summary.classCounts) {
    console.log(`[gsc:classify] ${row.className}=${row.count}`)
  }
  console.log(`[gsc:classify] wrote ${OUTPUT_JSON}`)
  console.log(`[gsc:classify] wrote ${OUTPUT_TSV}`)
}

main()
  .catch((e) => {
    console.error('[gsc:classify] fatal', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
