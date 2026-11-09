/**
 * Free SEO + technical-SEO crawler for the live site. No database, no paid service, no new dependency: it reads the
 * sitemaps, fetches the pages like a crawler does and reports what a job board needs to get right.
 *
 *   Per page     status, redirect chains (and 302s, loops), TTFB, compression, size, title, meta description, canonical,
 *                robots (meta + header), H1 and heading order, hreflang on noindex pages, Open Graph, lang, viewport,
 *                images without alt, thin content, JSON-LD validity and the Google Jobs JobPosting requirements
 *                (title, description, datePosted, organisation, location or remote, validThrough, salary, employment type).
 *   Link graph   broken internal links, links that redirect, orphan pages, pages deeper than 4 clicks, linked pages
 *                missing from the sitemap. With --full it also follows links to pages the sitemap lacks (pagination,
 *                companies, filters) so orphan and depth results see the whole graph.
 *   Duplicates   same job twice (same employer, title and place), one posting under several employer names, duplicate
 *                titles, descriptions and page text.
 *                The same role in different cities is reported once as information, not as a duplicate.
 *   Site         robots.txt, sitemap size/duplicates/lastmod/wrong host, sitemap URLs blocked by robots.txt, http->https,
 *                apex->www, soft 404s, trailing-slash / upper-case / tracking-parameter duplicates, pagination past the
 *                end, HSTS. Optionally (--external=N) a sample of outbound apply links.
 *
 * Usage:
 *   npm run seo:crawl                          # all non-job pages + 500 evenly spaced job pages
 *   npm run seo:crawl -- --full                # every sitemap URL (about 4,400 pages, around 10 minutes)
 *   npm run seo:crawl -- --base=https://staging.example.com --sample=200 --concurrency=3
 *   npm run seo:crawl -- --full --external=100 --strict
 *
 * Options (all optional):
 *   --base=URL            site to crawl (default $SEO_BASE_URL or https://www.6figjobs.com)
 *   --sample=N            job pages to crawl when not --full (default 500)
 *   --full                crawl every sitemap URL and run the orphan / depth checks
 *   --concurrency=N       parallel requests (default 5; be kind to the origin)
 *   --delay-ms=N          wait before each request (default 0)
 *   --timeout-ms=N        per-request timeout (default 20000)
 *   --max-link-checks=N   internal link targets to verify that the crawl did not already fetch (default 2000)
 *   --max-discovered=N    with --full, extra pages to crawl by following links the sitemap lacks (default 3000)
 *   --no-discover         with --full, skip that (orphan and depth checks are then skipped too)
 *   --external=N          outbound links to check (default 0 = none)
 *   --out=PATH            JSON report (default .tmp/seo-crawl/report.json)
 *   --strict              exit 1 when any critical issue is found
 *
 * Behind an HTTPS proxy: NODE_USE_ENV_PROXY=1 (Node 22.21+) and NODE_EXTRA_CA_CERTS=<bundle>.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import * as cheerio from 'cheerio'
import {
  analyzeGraph,
  checkPage,
  flattenJsonLd,
  isAllowedByRobots,
  isNoindex,
  jobSignature,
  normalizeUrl,
  pageKind,
  parsePage,
  parseRobots,
  percentile,
  typesOf,
  type Issue,
  type PageFacts,
  type Severity,
} from '../lib/seo/crawlChecks'

/* ----------------------------------------------------------------------------------------------------------------- */
/* Options                                                                                                           */
/* ----------------------------------------------------------------------------------------------------------------- */

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : 'true'] as const
  }),
)
const num = (key: string, fallback: number) => {
  const n = Number(args.get(key) ?? fallback)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

const BASE = (args.get('base') ?? process.env.SEO_BASE_URL ?? 'https://www.6figjobs.com').replace(/\/+$/, '')
const ORIGIN = new URL(BASE).origin
const HOST = new URL(BASE).host
const FULL = args.has('full')
const SAMPLE = num('sample', 500)
const CONCURRENCY = Math.max(1, num('concurrency', 5))
const DELAY_MS = num('delay-ms', 0)
const TIMEOUT_MS = num('timeout-ms', 20_000)
const MAX_LINK_CHECKS = num('max-link-checks', 2000)
const EXTERNAL = num('external', 0)
const DISCOVER_MAX = num('max-discovered', 3000)
const OUT = args.get('out') ?? '.tmp/seo-crawl/report.json'
const STRICT = args.has('strict')
const UA = 'SixFigAudit/1.0 (own-site SEO check)'

/* ----------------------------------------------------------------------------------------------------------------- */
/* Findings                                                                                                          */
/* ----------------------------------------------------------------------------------------------------------------- */

type Found = Issue & { url: string }
const found: Found[] = []
const add = (severity: Severity, code: string, url: string, detail?: string) => found.push({ severity, code, url, detail })
const addAll = (url: string, issues: Issue[]) => issues.forEach((i) => add(i.severity, i.code, url, i.detail))

/* ----------------------------------------------------------------------------------------------------------------- */
/* HTTP                                                                                                              */
/* ----------------------------------------------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Hit = { status: number; headers: Headers; body: string | null; bytes: number; ttfbMs: number; error?: string }

/** One request, redirects not followed, retried once on a network error (a reset must not read as a dead page). */
async function hit(url: string, method: 'GET' | 'HEAD' = 'GET'): Promise<Hit> {
  const first = await hitOnce(url, method)
  if (first.status !== 0) return first
  await sleep(750)
  return hitOnce(url, method)
}

/** A network error or timeout is status 0 with `error` set. */
async function hitOnce(url: string, method: 'GET' | 'HEAD'): Promise<Hit> {
  if (DELAY_MS) await sleep(DELAY_MS)
  const started = performance.now()
  try {
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      headers: { 'user-agent': UA, accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const ttfbMs = performance.now() - started
    if (method === 'HEAD') {
      await res.body?.cancel()
      return { status: res.status, headers: res.headers, body: null, bytes: 0, ttfbMs }
    }
    const buf = await res.arrayBuffer()
    return { status: res.status, headers: res.headers, body: new TextDecoder().decode(buf), bytes: buf.byteLength, ttfbMs }
  } catch (e) {
    const err = e as { message?: string; cause?: { code?: string } }
    return { status: 0, headers: new Headers(), body: null, bytes: 0, ttfbMs: performance.now() - started, error: err.cause?.code ?? err.message ?? 'error' }
  }
}

type Chain = { hops: Array<{ url: string; status: number }>; final: Hit; finalUrl: string; loop: boolean }

/** Follows redirects by hand (up to 10) so every hop and its status code is visible. */
async function follow(url: string, method: 'GET' | 'HEAD' = 'GET'): Promise<Chain> {
  const hops: Chain['hops'] = []
  const seen = new Set([url])
  let current = url
  for (let i = 0; i < 10; i++) {
    const res = await hit(current, method)
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      hops.push({ url: current, status: res.status })
      const next = new URL(location, current).toString()
      if (seen.has(next)) return { hops, final: res, finalUrl: next, loop: true }
      seen.add(next)
      current = next
      continue
    }
    return { hops, final: res, finalUrl: current, loop: false }
  }
  return { hops, final: await hit(current, method), finalUrl: current, loop: true }
}

async function pool<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>, label?: string): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  let done = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      for (;;) {
        const i = next++
        if (i >= items.length) return
        results[i] = await fn(items[i], i)
        if (label && ++done % 250 === 0) console.error(`  ${label}: ${done}/${items.length}`)
      }
    }),
  )
  return results
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* robots.txt and sitemaps                                                                                           */
/* ----------------------------------------------------------------------------------------------------------------- */

async function checkRobots() {
  const url = `${ORIGIN}/robots.txt`
  const res = await hit(url)
  if (res.status !== 200 || res.body === null) {
    add('critical', 'robots-txt-missing', url, `status ${res.status} ${res.error ?? ''}`.trim())
    return parseRobots('')
  }
  const rules = parseRobots(res.body)
  if (rules.disallow.includes('/')) add('critical', 'robots-blocks-everything', url, 'Disallow: / for User-agent: *')
  if (rules.sitemaps.length === 0) add('warning', 'robots-no-sitemap', url)
  const extra = rules.sitemaps.filter((s) => !/\/sitemap(-jobs)?\.xml$/.test(s))
  if (extra.length > 0) add('info', 'robots-lists-child-sitemaps', url, `${extra.length} besides sitemap.xml / sitemap-jobs.xml`)
  return rules
}

type Entry = { loc: string; lastmod: string | null }

async function readSitemaps(): Promise<Entry[]> {
  const entries: Entry[] = []
  const queue = [`${ORIGIN}/sitemap.xml`]
  const seen = new Set(queue)
  while (queue.length > 0) {
    const url = queue.shift() as string
    const res = await hit(url)
    if (res.status !== 200 || res.body === null) {
      add('critical', 'sitemap-unreachable', url, `status ${res.status} ${res.error ?? ''}`.trim())
      continue
    }
    if (res.bytes > 50 * 1024 * 1024) add('critical', 'sitemap-over-50mb', url, `${res.bytes} bytes`)
    const $ = cheerio.load(res.body, { xmlMode: true })
    if ($('sitemapindex').length > 0) {
      $('sitemap > loc').each((_, el) => {
        const child = $(el).text().trim()
        if (child && !seen.has(child)) {
          seen.add(child)
          queue.push(child)
        }
      })
      continue
    }
    const urls = $('url')
    if (urls.length === 0) add('warning', 'sitemap-empty', url)
    if (urls.length > 50_000) add('critical', 'sitemap-over-50000-urls', url, `${urls.length} URLs`)
    urls.each((_, el) => {
      const loc = $(el).children('loc').text().trim()
      if (loc) entries.push({ loc, lastmod: $(el).children('lastmod').text().trim() || null })
    })
  }
  return entries
}

function checkSitemapEntries(entries: Entry[]) {
  const seen = new Set<string>()
  const days = new Map<string, number>()
  let missing = 0
  const now = Date.now()
  for (const { loc, lastmod } of entries) {
    const key = normalizeUrl(loc)
    if (key && seen.has(key)) add('warning', 'sitemap-duplicate-url', loc)
    if (key) seen.add(key)
    if (new URL(loc).origin !== ORIGIN) add('critical', 'sitemap-wrong-origin', loc, `expected ${ORIGIN}`)
    if (!lastmod) {
      missing++
      continue
    }
    const t = Date.parse(lastmod)
    if (!Number.isFinite(t)) add('warning', 'sitemap-lastmod-invalid', loc, lastmod)
    else if (t > now + 24 * 3600_000) add('warning', 'sitemap-lastmod-future', loc, lastmod)
    else days.set(lastmod.slice(0, 10), (days.get(lastmod.slice(0, 10)) ?? 0) + 1)
  }
  if (missing > 0) add('info', 'sitemap-lastmod-missing', `${ORIGIN}/sitemap.xml`, `${missing} of ${entries.length} URLs`)
  const [topDay, topCount] = [...days.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
  if (topCount > 100 && topCount / entries.length > 0.5) {
    add(
      'info',
      'sitemap-lastmod-clustered',
      `${ORIGIN}/sitemap.xml`,
      `${topCount} of ${entries.length} URLs share ${topDay}: fine if that is when they were really published, a problem if it is a build date`,
    )
  }
}

function selectPages(entries: Entry[]): Entry[] {
  const unique = [...new Map(entries.map((e) => [e.loc, e])).values()]
  const jobs = unique.filter((e) => pageKind(e.loc) === 'job')
  if (FULL || jobs.length <= SAMPLE) return unique
  const step = jobs.length / SAMPLE
  const sampled = Array.from({ length: SAMPLE }, (_, i) => jobs[Math.floor(i * step)])
  return [...unique.filter((e) => pageKind(e.loc) !== 'job'), ...sampled]
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Pages                                                                                                             */
/* ----------------------------------------------------------------------------------------------------------------- */

type PageResult = {
  url: string
  /** In a sitemap (false: found by following a link). */
  listed: boolean
  /** The URL redirected, so `facts` describe another page (it must not count as a duplicate of it). */
  redirected: boolean
  finalUrl: string
  firstStatus: number
  status: number
  facts: PageFacts | null
  indexable: boolean
  ttfbMs: number
  /** Internal link targets, normalised, with the rel=nofollow ones left out. */
  links: string[]
  external: string[]
  job: ReturnType<typeof jobSignature> | null
}

const ASSET = /\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|json|txt|pdf|woff2?|map|zip)$/i
const SKIP_PATH = /^\/(_next|api|cdn-cgi)\//

async function crawlPage(entry: Entry, listed: boolean): Promise<PageResult> {
  const chain = await follow(entry.loc)
  const { final } = chain
  const result: PageResult = {
    url: entry.loc,
    listed,
    redirected: chain.hops.length > 0,
    finalUrl: chain.finalUrl,
    firstStatus: chain.hops[0]?.status ?? final.status,
    status: final.status,
    facts: null,
    indexable: false,
    ttfbMs: final.ttfbMs,
    links: [],
    external: [],
    job: null,
  }

  if (chain.loop) add('critical', 'redirect-loop', entry.loc, chain.hops.map((h) => h.status).join(' > '))
  else if (chain.hops.length > 0) {
    if (listed) add('warning', 'sitemap-url-redirects', entry.loc, `${chain.hops.map((h) => h.status).join(' > ')} -> ${chain.finalUrl}`)
    if (chain.hops.length > 1) add('warning', 'redirect-chain', entry.loc, `${chain.hops.length} hops -> ${chain.finalUrl}`)
    if (chain.hops.some((h) => h.status === 302 || h.status === 307)) add('info', 'temporary-redirect', entry.loc, chain.finalUrl)
  }

  if (final.status !== 200) {
    if (listed) add('critical', 'sitemap-url-not-200', entry.loc, final.error ? `network error: ${final.error}` : `status ${final.status}`)
    return result
  }
  if (final.body === null || !/text\/html/i.test(final.headers.get('content-type') ?? '')) {
    add('warning', 'non-html-content-type', entry.loc, final.headers.get('content-type') ?? 'none')
    return result
  }

  const facts = parsePage(final.body)
  result.facts = facts
  const xRobotsTag = final.headers.get('x-robots-tag') ?? ''
  result.indexable = !isNoindex(facts, { xRobotsTag })
  addAll(
    chain.finalUrl,
    checkPage(facts, {
      url: chain.finalUrl,
      origin: ORIGIN,
      status: final.status,
      inSitemap: listed,
      contentType: final.headers.get('content-type') ?? '',
      contentEncoding: final.headers.get('content-encoding') ?? '',
      xRobotsTag,
      bytes: final.bytes,
      ttfbMs: final.ttfbMs,
    }),
  )

  const posting = flattenJsonLd(facts.jsonLd).find((n) => typesOf(n).includes('JobPosting'))
  if (posting) result.job = jobSignature(posting)

  for (const { href, nofollow } of facts.links) {
    const target = normalizeUrl(href, chain.finalUrl)
    if (!target) continue
    const u = new URL(target)
    if (u.origin !== ORIGIN) {
      if (pageKind(entry.loc) === 'job') result.external.push(target)
      continue
    }
    if (nofollow || SKIP_PATH.test(u.pathname) || ASSET.test(u.pathname)) continue
    result.links.push(target)
  }
  return result
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Links                                                                                                             */
/* ----------------------------------------------------------------------------------------------------------------- */

async function checkInternalLinks(results: PageResult[], inSitemap: Set<string>): Promise<void> {
  const known = new Map<string, { status: number; to?: string }>()
  for (const r of results) {
    const key = normalizeUrl(r.url) as string
    known.set(key, { status: r.firstStatus, to: r.firstStatus >= 300 && r.firstStatus < 400 ? r.finalUrl : undefined })
    if (r.status === 200) known.set(normalizeUrl(r.finalUrl) as string, { status: 200 })
  }

  const sources = new Map<string, string[]>()
  for (const r of results) for (const t of new Set(r.links)) sources.set(t, [...(sources.get(t) ?? []), r.url])
  const unknown = [...sources.keys()]
    .filter((t) => !known.has(t))
    .sort((a, b) => (sources.get(b)?.length ?? 0) - (sources.get(a)?.length ?? 0))
  const toCheck = unknown.slice(0, MAX_LINK_CHECKS)
  if (unknown.length > toCheck.length) {
    add('info', 'link-checks-capped', ORIGIN, `${unknown.length - toCheck.length} of ${unknown.length} link targets not verified (raise --max-link-checks)`)
  }
  await pool(
    toCheck,
    CONCURRENCY,
    async (target) => {
      let res = await hit(target, 'HEAD')
      if (res.status === 0 || res.status === 405 || res.status === 501) res = await hit(target, 'GET')
      const location = res.headers.get('location')
      known.set(target, { status: res.status, to: location ? new URL(location, target).toString() : undefined })
    },
    'link targets',
  )

  const notListed: string[] = []
  for (const [target, { status, to }] of known) {
    const from = sources.get(target)
    if (!from) continue
    const detail = `linked from ${from.length} page(s), e.g. ${from.slice(0, 3).join(', ')}`
    if (status === 0 || status >= 400) add('critical', 'broken-internal-link', target, `status ${status || 'network error'}; ${detail}`)
    else if (status >= 300) add('warning', 'internal-link-redirects', target, `${status} -> ${to ?? '?'}; ${detail}`)
    else if (status === 200 && !target.includes('?') && !inSitemap.has(target)) notListed.push(target)
  }
  if (notListed.length > 0) {
    add('info', 'linked-not-in-sitemap', notListed[0], `${notListed.length} internally linked, 200, not in any sitemap, e.g. ${notListed.slice(0, 5).join(', ')}`)
  }
}

function checkGraph(results: PageResult[], ready: boolean) {
  if (!ready) {
    add('info', 'graph-checks-skipped', ORIGIN, 'orphan pages and click depth need every page and every page that links to them: run with --full')
    return
  }
  const nodes = results.map((r) => ({ url: r.url, links: r.links, indexable: r.indexable, inSitemap: r.listed }))
  for (const f of analyzeGraph(nodes, `${ORIGIN}/`)) add(f.code === 'deep-page' ? 'info' : 'warning', f.code, f.url, f.detail)
}

/** Pages worth following from a link: real pages on this site, with no query other than ?page=. */
function discoverable(url: string): boolean {
  const u = new URL(url)
  if (u.origin !== ORIGIN || SKIP_PATH.test(u.pathname) || ASSET.test(u.pathname)) return false
  if (/^\/(search|feeds|sign-in|account|post-a-job)(\/|$)/.test(u.pathname)) return false
  return [...u.searchParams.keys()].every((k) => k === 'page')
}

/**
 * Crawls what the crawled pages link to but no sitemap lists (pagination, company pages, filters), level by level, so
 * the link graph is whole. `done` is false when it stopped at --max-discovered.
 */
async function discover(results: PageResult[]): Promise<{ done: boolean; found: PageResult[] }> {
  const seen = new Set(results.map((r) => normalizeUrl(r.url) as string))
  const found: PageResult[] = []
  let frontier = results
  while (frontier.length > 0) {
    const queue: Entry[] = []
    for (const r of frontier) {
      for (const t of r.links) {
        if (!seen.has(t) && discoverable(t)) {
          seen.add(t)
          queue.push({ loc: t, lastmod: null })
        }
      }
    }
    const room = DISCOVER_MAX - found.length
    if (queue.length > room) {
      found.push(...(await pool(queue.slice(0, Math.max(0, room)), CONCURRENCY, (e) => crawlPage(e, false), 'discovered')))
      return { done: false, found }
    }
    frontier = await pool(queue, CONCURRENCY, (e) => crawlPage(e, false), 'discovered')
    found.push(...frontier)
  }
  return { done: true, found }
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Duplicates                                                                                                        */
/* ----------------------------------------------------------------------------------------------------------------- */

function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (k) out.set(k, [...(out.get(k) ?? []), item])
  }
  return out
}

function checkDuplicates(results: PageResult[]) {
  // A URL that redirects shows another page's content, and ?page=N repeats its first page's title: neither is a duplicate.
  const pages = results.filter((r) => r.facts && r.indexable && !r.redirected && !/[?&]page=/.test(r.url))
  const list = (g: PageResult[]) => g.slice(0, 4).map((r) => r.url).join(', ')

  // The same role in different cities is normal for a job board (one posting per location): information only.
  let multiLocationGroups = 0
  let multiLocationPages = 0
  for (const [title, group] of groupBy(pages, (r) => r.facts?.title ?? null)) {
    if (group.length < 2) continue
    if (group.every((r) => r.job)) {
      for (const same of groupBy(group, (r) => `${r.job?.org}|${r.job?.title}|${r.job?.place}`).values()) {
        if (same.length > 1) add('warning', 'duplicate-job', same[0].url, `${same.length} pages, same employer, title and place: ${list(same)}`)
      }
      multiLocationGroups++
      multiLocationPages += group.length
    } else {
      add('warning', 'duplicate-title', group[0].url, `"${title.slice(0, 70)}" on ${group.length} pages: ${list(group)}`)
    }
  }
  if (multiLocationGroups > 0) {
    add('info', 'repeated-title-multi-location', ORIGIN, `${multiLocationGroups} job titles on ${multiLocationPages} pages (one posting per location; not a defect unless they stay unindexed)`)
  }

  // One posting listed under several employer names (e.g. a parent and its subsidiaries): same title, place and text.
  for (const group of groupBy(pages.filter((r) => r.job?.desc), (r) => `${r.job?.title}|${r.job?.place}|${r.job?.desc}`).values()) {
    const orgs = [...new Set(group.map((r) => r.job?.org))]
    if (orgs.length > 1) add('warning', 'duplicate-job-across-employers', group[0].url, `same title, place and description under ${orgs.join(' / ')}: ${list(group)}`)
  }

  for (const [description, group] of groupBy(pages.filter((r) => !r.job), (r) => r.facts?.description ?? null)) {
    if (group.length > 1) add('info', 'duplicate-meta-description', group[0].url, `"${description.slice(0, 60)}…" on ${group.length} pages: ${list(group)}`)
  }
  for (const group of groupBy(pages, (r) => r.facts?.textHash ?? null).values()) {
    if (group.length > 1) add('warning', 'duplicate-content', group[0].url, `identical page text on ${group.length} pages: ${list(group)}`)
  }
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Site-level probes                                                                                                 */
/* ----------------------------------------------------------------------------------------------------------------- */

async function canonicalOf(url: string): Promise<{ chain: Chain; canonical: string | null; noindex: boolean }> {
  const chain = await follow(url)
  const facts = chain.final.status === 200 && chain.final.body ? parsePage(chain.final.body) : null
  const canonical = facts?.canonicals[0] ? normalizeUrl(facts.canonicals[0], chain.finalUrl) : null
  return { chain, canonical, noindex: facts ? isNoindex(facts, { xRobotsTag: chain.final.headers.get('x-robots-tag') ?? '' }) : false }
}

async function probeSite() {
  const jobsClean = normalizeUrl(`${ORIGIN}/jobs`)

  const http = await follow(`http://${HOST}/`)
  if (!(http.hops[0] && [301, 308].includes(http.hops[0].status) && http.finalUrl.startsWith('https://'))) {
    add('warning', 'http-not-redirected-to-https', `http://${HOST}/`, `first response ${http.hops[0]?.status ?? http.final.status}`)
  }
  if (HOST.startsWith('www.')) {
    const apex = await follow(`https://${HOST.slice(4)}/`)
    if (!(apex.hops[0] && [301, 308].includes(apex.hops[0].status) && new URL(apex.finalUrl).host === HOST)) {
      add('warning', 'apex-not-redirected-to-www', `https://${HOST.slice(4)}/`, `first response ${apex.hops[0]?.status ?? apex.final.status}`)
    }
  }

  const missing = `${ORIGIN}/this-page-should-not-exist-${Date.now().toString(36)}`
  const soft = await canonicalOf(missing)
  if (soft.chain.final.status === 200) add('critical', 'soft-404', missing, 'an unknown URL answers 200')
  else if (soft.chain.final.status === 404 && soft.chain.final.body && !isNoindex(parsePage(soft.chain.final.body), { xRobotsTag: soft.chain.final.headers.get('x-robots-tag') ?? '' })) {
    add('info', '404-page-indexable', missing, '404 status but no noindex')
  }

  const slash = await canonicalOf(`${ORIGIN}/jobs/`)
  if (slash.chain.final.status === 200 && slash.chain.hops.length === 0 && slash.canonical !== jobsClean && !slash.noindex) {
    add('warning', 'trailing-slash-duplicate', `${ORIGIN}/jobs/`, `200 with canonical ${slash.canonical ?? 'none'}`)
  }
  const upper = await canonicalOf(`${ORIGIN}/JOBS`)
  if (upper.chain.final.status === 200 && upper.chain.hops.length === 0 && upper.canonical !== jobsClean && !upper.noindex) {
    add('warning', 'uppercase-url-duplicate', `${ORIGIN}/JOBS`, `200 with canonical ${upper.canonical ?? 'none'}`)
  }
  const query = await canonicalOf(`${ORIGIN}/jobs?utm_source=seo-crawl&ref=probe`)
  if (query.chain.final.status === 200 && query.canonical !== jobsClean && !query.noindex) {
    add('warning', 'tracking-parameter-canonical', `${ORIGIN}/jobs?utm_source=seo-crawl&ref=probe`, `canonical is ${query.canonical ?? 'none'}`)
  }
  const past = await canonicalOf(`${ORIGIN}/jobs?page=99999`)
  if (past.chain.final.status === 200 && !past.noindex) {
    add('warning', 'pagination-past-end-indexable', `${ORIGIN}/jobs?page=99999`, 'a page past the last one answers 200 and is indexable')
  }

  const hsts = (await hit(`${ORIGIN}/`, 'HEAD')).headers.get('strict-transport-security')
  if (!hsts) add('info', 'missing-hsts', `${ORIGIN}/`)
}

async function checkExternalLinks(results: PageResult[]) {
  const sources = new Map<string, string>()
  for (const r of results) for (const t of r.external) if (!sources.has(t)) sources.set(t, r.url)
  const all = [...sources.keys()]
  if (all.length === 0) return
  const step = Math.max(1, all.length / EXTERNAL)
  const sample = Array.from({ length: Math.min(EXTERNAL, all.length) }, (_, i) => all[Math.floor(i * step)])
  await pool(
    sample,
    Math.min(3, CONCURRENCY),
    async (target) => {
      const chain = await follow(target, 'HEAD')
      let status = chain.final.status
      if (status === 0 || status === 405 || status === 501) status = (await follow(target, 'GET')).final.status
      const from = sources.get(target) ?? ''
      if ([401, 403, 429, 999].includes(status)) add('info', 'external-link-bot-blocked', target, `status ${status}; on ${from}`)
      else if (status === 0 || status >= 400) add('warning', 'broken-external-link', target, `status ${status || 'network error'}; on ${from}`)
    },
    'external links',
  )
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Report                                                                                                            */
/* ----------------------------------------------------------------------------------------------------------------- */

function report(results: PageResult[], total: number, fullCoverage: boolean, startedAt: number) {
  const order: Severity[] = ['critical', 'warning', 'info']
  const byCode = new Map<string, Found[]>()
  for (const f of found) byCode.set(f.code, [...(byCode.get(f.code) ?? []), f])
  const groups = [...byCode.entries()].sort(
    (a, b) => order.indexOf(a[1][0].severity) - order.indexOf(b[1][0].severity) || b[1].length - a[1].length,
  )
  const count = (s: Severity) => found.filter((f) => f.severity === s).length

  const times = results.filter((r) => r.status === 200).map((r) => r.ttfbMs)
  const stats = {
    pagesCrawled: results.length,
    listedCrawled: results.filter((r) => r.listed).length,
    sitemapUrls: total,
    coverage: fullCoverage ? 'full' : 'sample',
    ok200: results.filter((r) => r.status === 200).length,
    indexable: results.filter((r) => r.indexable).length,
    ttfbMs: { p50: Math.round(percentile(times, 50)), p95: Math.round(percentile(times, 95)), max: Math.round(Math.max(0, ...times)) },
    seconds: Math.round((Date.now() - startedAt) / 1000),
  }

  console.log(`\nSEO crawl of ${BASE}`)
  console.log(`  pages: ${stats.pagesCrawled} (${stats.listedCrawled} of ${total} sitemap URLs, ${stats.pagesCrawled - stats.listedCrawled} found by following links; ${stats.coverage}), ${stats.ok200} returned 200, ${stats.indexable} indexable`)
  console.log(`  time to first byte: median ${stats.ttfbMs.p50} ms, p95 ${stats.ttfbMs.p95} ms, max ${stats.ttfbMs.max} ms   (${stats.seconds}s)`)
  console.log(`  issues: ${count('critical')} critical, ${count('warning')} warnings, ${count('info')} info\n`)
  for (const [code, items] of groups) {
    const first = items[0]
    console.log(`[${first.severity.toUpperCase()}] ${code}  x${items.length}`)
    for (const f of items.slice(0, 3)) console.log(`    ${f.url}${f.detail ? `  (${f.detail})` : ''}`)
  }
  if (groups.length === 0) console.log('No issues found.')

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, stats, summary: Object.fromEntries(groups.map(([c, i]) => [c, { severity: i[0].severity, count: i.length }])), issues: found }, null, 2))
  console.log(`\nFull report: ${OUT}`)
  return count('critical')
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Main                                                                                                              */
/* ----------------------------------------------------------------------------------------------------------------- */

async function main() {
  const startedAt = Date.now()
  console.error(`Crawling ${BASE} (concurrency ${CONCURRENCY}${FULL ? ', full' : `, ${SAMPLE} job pages`})`)

  const robots = await checkRobots()
  const entries = await readSitemaps()
  if (entries.length === 0) {
    add('critical', 'no-sitemap-urls', `${ORIGIN}/sitemap.xml`, 'no URLs found in any sitemap')
    process.exitCode = report([], 0, false, startedAt) > 0 && STRICT ? 1 : 0
    return
  }
  checkSitemapEntries(entries)

  const selected = selectPages(entries)
  const total = new Set(entries.map((e) => e.loc)).size
  const fullCoverage = selected.length === total
  console.error(`  ${entries.length} sitemap URLs; crawling ${selected.length}`)

  for (const e of selected) {
    const u = new URL(e.loc)
    if (!isAllowedByRobots(robots, u.pathname + u.search)) add('critical', 'sitemap-url-blocked-by-robots', e.loc)
  }

  const listedResults = await pool(selected, CONCURRENCY, (e) => crawlPage(e, true), 'pages')
  let results = listedResults
  let graphReady = false
  if (fullCoverage && !args.has('no-discover')) {
    const { done, found: extra } = await discover(listedResults)
    results = [...listedResults, ...extra]
    graphReady = done
    if (!done) add('info', 'graph-partial', ORIGIN, `link discovery stopped at ${DISCOVER_MAX} extra pages (raise --max-discovered); orphan and depth checks skipped`)
  }
  await checkInternalLinks(results, new Set(entries.map((e) => normalizeUrl(e.loc) as string)))
  checkGraph(results, graphReady)
  checkDuplicates(results)
  await probeSite()
  if (EXTERNAL > 0) await checkExternalLinks(results)

  const critical = report(results, total, fullCoverage, startedAt)
  if (STRICT && critical > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 2
})
