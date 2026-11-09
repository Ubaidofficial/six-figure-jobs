// lib/seo/crawlChecks.ts
//
// The rules behind scripts/seo-crawl.ts: given one fetched page (HTML, headers, status) what is wrong with it for
// search, and for Google Jobs in particular. Pure functions only (no network, no database) so each rule is unit-tested.
// Thresholds follow this site's own conventions: titles up to 65 characters (lib/seo/jobMeta.ts), descriptions up to 160.

import { createHash } from 'node:crypto'
import * as cheerio from 'cheerio'

export type Severity = 'critical' | 'warning' | 'info'
export type Issue = { severity: Severity; code: string; detail?: string }

export const TITLE_MAX = 65
export const TITLE_MIN = 20
export const DESCRIPTION_MAX = 160
export const DESCRIPTION_MIN = 70
export const THIN_WORDS = 150
export const SLOW_RESPONSE_MS = 2000
export const MAX_HTML_BYTES = 1_500_000
export const MAX_CLICK_DEPTH = 4

const issue = (severity: Severity, code: string, detail?: string): Issue => ({ severity, code, detail })

/* ----------------------------------------------------------------------------------------------------------------- */
/* URLs                                                                                                              */
/* ----------------------------------------------------------------------------------------------------------------- */

/** Comparable form of a URL: no fragment, lower-case host, no trailing slash (except the root). Query is kept. */
export function normalizeUrl(input: string, base?: string): string | null {
  try {
    const u = new URL(input, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    u.hostname = u.hostname.toLowerCase()
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '')
    return u.toString()
  } catch {
    return null
  }
}

export type PageKind = 'home' | 'job' | 'article' | 'listing'

export function pageKind(url: string): PageKind {
  const path = new URL(url).pathname
  if (path === '/' || path === '') return 'home'
  if (path.startsWith('/job/')) return 'job'
  if (path.startsWith('/blog/')) return 'article'
  return 'listing'
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* HTML                                                                                                              */
/* ----------------------------------------------------------------------------------------------------------------- */

export type JsonLdBlock = { data: unknown | null; error?: string }

export type PageFacts = {
  title: string | null
  titleCount: number
  description: string | null
  canonicals: string[]
  metaRobots: string
  h1Count: number
  headingSkips: number
  lang: string | null
  hasViewport: boolean
  hasCharset: boolean
  hasOgTitle: boolean
  hasOgDescription: boolean
  hasOgImage: boolean
  hasTwitterCard: boolean
  hreflang: Array<{ lang: string; href: string }>
  imagesTotal: number
  imagesMissingAlt: number
  wordCount: number
  textHash: string
  links: Array<{ href: string; nofollow: boolean }>
  jsonLd: JsonLdBlock[]
}

export function parsePage(html: string): PageFacts {
  const $ = cheerio.load(html)
  const meta = (name: string) => $(`meta[name="${name}"]`).first().attr('content')?.trim() ?? null
  const prop = (name: string) => $(`meta[property="${name}"]`).first().attr('content')?.trim() ?? null

  const titles = $('head title')
  let skips = 0
  let prev = 0
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    const level = Number(el.tagName.slice(1))
    if (prev && level > prev + 1) skips++
    prev = level
  })

  const hreflang: PageFacts['hreflang'] = []
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    hreflang.push({ lang: $(el).attr('hreflang') ?? '', href: $(el).attr('href') ?? '' })
  })

  const images = $('body img')
  let missingAlt = 0
  images.each((_, el) => {
    if ($(el).attr('alt') === undefined) missingAlt++
  })

  const links: PageFacts['links'] = []
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').trim()
    if (href) links.push({ href, nofollow: /\bnofollow\b/i.test($(el).attr('rel') ?? '') })
  })

  const jsonLd: JsonLdBlock[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text()
    try {
      jsonLd.push({ data: JSON.parse(raw) })
    } catch (e) {
      jsonLd.push({ data: null, error: e instanceof Error ? e.message : 'invalid JSON' })
    }
  })

  const body = $('body').clone()
  body.find('script,style,noscript,template').remove()
  const text = body.text().replace(/\s+/g, ' ').trim()

  return {
    title: titles.length ? titles.first().text().trim() : null,
    titleCount: titles.length,
    description: meta('description'),
    canonicals: $('link[rel="canonical"]')
      .map((_, el) => ($(el).attr('href') ?? '').trim())
      .get(),
    metaRobots: [meta('robots'), meta('googlebot')].filter(Boolean).join(',').toLowerCase(),
    h1Count: $('h1').length,
    headingSkips: skips,
    lang: $('html').attr('lang')?.trim() || null,
    hasViewport: $('meta[name="viewport"]').length > 0,
    hasCharset: $('meta[charset]').length > 0 || $('meta[http-equiv="Content-Type" i]').length > 0,
    hasOgTitle: Boolean(prop('og:title')),
    hasOgDescription: Boolean(prop('og:description')),
    hasOgImage: Boolean(prop('og:image')),
    hasTwitterCard: Boolean(meta('twitter:card')),
    hreflang,
    imagesTotal: images.length,
    imagesMissingAlt: missingAlt,
    wordCount: text ? text.split(' ').length : 0,
    textHash: createHash('md5').update(text).digest('hex'),
    links,
    jsonLd,
  }
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* JSON-LD and Google Jobs                                                                                           */
/* ----------------------------------------------------------------------------------------------------------------- */

type Node = Record<string, unknown>

/** Every object in the JSON-LD blocks, with `@graph` and arrays flattened. */
export function flattenJsonLd(blocks: JsonLdBlock[]): Node[] {
  const out: Node[] = []
  const visit = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(visit)
    if (v && typeof v === 'object') {
      out.push(v as Node)
      const graph = (v as Node)['@graph']
      if (graph) visit(graph)
    }
  }
  blocks.forEach((b) => visit(b.data))
  return out
}

export function typesOf(node: Node): string[] {
  const t = node['@type']
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string')
}

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v])
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const obj = (v: unknown): Node | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Node) : null)
const parseDate = (v: unknown): number | null => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : null
}

const EMPLOYMENT_TYPES = new Set([
  'FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN', 'VOLUNTEER', 'PER_DIEM', 'OTHER',
])

/**
 * Who, where and what a JobPosting is, to tell a duplicate posting from the same role in another city.
 * `desc` is a hash of the description text: equal under different employer names means one posting listed twice.
 */
export function jobSignature(node: Node): { title: string; org: string; place: string; desc: string } {
  const loc = obj(asList(node.jobLocation)[0])
  const address = obj(loc?.address)
  const place =
    str(address?.addressLocality) ||
    str(address?.addressRegion) ||
    str(address?.addressCountry) ||
    (str(node.jobLocationType) === 'TELECOMMUTE' ? 'remote' : '')
  const text = str(node.description).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  return {
    title: str(node.title),
    org: str(obj(node.hiringOrganization)?.name),
    place: place.toLowerCase(),
    desc: text ? createHash('md5').update(text).digest('hex') : '',
  }
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Link graph                                                                                                        */
/* ----------------------------------------------------------------------------------------------------------------- */

export type GraphNode = {
  url: string
  /** Internal link targets (rel=nofollow left out). */
  links: string[]
  /** 200 and not noindex. */
  indexable: boolean
  inSitemap: boolean
}

export type GraphFinding = { url: string; code: 'orphan-page' | 'unreachable-from-home' | 'deep-page'; detail: string }

/**
 * Orphans, unreachable pages and deep pages among the pages listed in the sitemap, using every crawled page
 * (listed or not) as a carrier of links. Only meaningful when the crawl covered all the pages that link to them.
 */
export function analyzeGraph(nodes: GraphNode[], homeUrl: string, maxDepth: number = MAX_CLICK_DEPTH): GraphFinding[] {
  const byUrl = new Map<string, GraphNode>()
  for (const n of nodes) {
    const key = normalizeUrl(n.url)
    if (key) byUrl.set(key, n)
  }
  const inbound = new Map<string, number>()
  for (const [url, n] of byUrl) {
    for (const t of new Set(n.links)) {
      const target = normalizeUrl(t)
      if (target && target !== url) inbound.set(target, (inbound.get(target) ?? 0) + 1)
    }
  }

  const home = normalizeUrl(homeUrl) as string
  const depth = new Map<string, number>([[home, 0]])
  const queue = [home]
  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const t of byUrl.get(current)?.links ?? []) {
      const target = normalizeUrl(t)
      if (target && !depth.has(target) && byUrl.has(target)) {
        depth.set(target, (depth.get(current) as number) + 1)
        queue.push(target)
      }
    }
  }

  const out: GraphFinding[] = []
  for (const [url, n] of byUrl) {
    if (url === home || !n.inSitemap || !n.indexable) continue
    const d = depth.get(url)
    if ((inbound.get(url) ?? 0) === 0) out.push({ url: n.url, code: 'orphan-page', detail: 'in the sitemap, no crawled page links to it' })
    else if (d === undefined) out.push({ url: n.url, code: 'unreachable-from-home', detail: 'linked only from pages that the homepage does not reach' })
    else if (d > maxDepth) out.push({ url: n.url, code: 'deep-page', detail: `${d} clicks from the homepage` })
  }
  return out
}

/** Google Jobs requirements and recommendations for one JobPosting node. */
export function checkJobPosting(node: Node, now: Date = new Date()): Issue[] {
  const out: Issue[] = []
  const t = now.getTime()

  if (!str(node.title)) out.push(issue('critical', 'jp-missing-title'))
  const description = str(node.description).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!description) out.push(issue('critical', 'jp-missing-description'))
  else if (description.length < 100) out.push(issue('warning', 'jp-description-short', `${description.length} chars`))
  if (!str(obj(node.hiringOrganization)?.name)) out.push(issue('critical', 'jp-missing-organization'))

  const posted = parseDate(node.datePosted)
  if (!node.datePosted) out.push(issue('critical', 'jp-missing-date-posted'))
  else if (posted === null) out.push(issue('critical', 'jp-bad-date-posted', String(node.datePosted)))
  else if (posted > t + 24 * 3600_000) out.push(issue('warning', 'jp-date-posted-future', String(node.datePosted)))

  const locations = asList(node.jobLocation)
  const remote = str(node.jobLocationType) === 'TELECOMMUTE'
  if (locations.length === 0 && !(remote && node.applicantLocationRequirements)) {
    out.push(issue('critical', 'jp-no-location'))
  } else if (remote && !node.applicantLocationRequirements) {
    out.push(issue('warning', 'jp-remote-no-applicant-location'))
  }
  if (locations.length > 0 && !locations.some((l) => str(obj(obj(l)?.address)?.addressCountry))) {
    out.push(issue('warning', 'jp-no-country'))
  }

  if (node.validThrough === undefined) {
    out.push(issue('info', 'jp-no-valid-through'))
  } else {
    const until = parseDate(node.validThrough)
    if (until === null) out.push(issue('warning', 'jp-bad-valid-through', String(node.validThrough)))
    else if (until < t) out.push(issue('critical', 'jp-expired', String(node.validThrough)))
    else if (posted !== null && until < posted) out.push(issue('warning', 'jp-valid-through-before-posted'))
  }

  const salary = obj(node.baseSalary)
  if (!salary) {
    out.push(issue('warning', 'jp-no-salary'))
  } else {
    const value = obj(salary.value)
    const amounts = [value?.minValue, value?.maxValue, value?.value].filter((v) => v !== undefined && v !== '')
    if (!str(salary.currency) || amounts.length === 0 || amounts.some((v) => !Number.isFinite(Number(v)))) {
      out.push(issue('warning', 'jp-salary-invalid'))
    }
  }

  const types = asList(node.employmentType)
  if (types.some((e) => !EMPLOYMENT_TYPES.has(String(e)))) {
    out.push(issue('warning', 'jp-bad-employment-type', types.join(',')))
  }
  return out
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* One page                                                                                                          */
/* ----------------------------------------------------------------------------------------------------------------- */

export type PageContext = {
  url: string
  /** Where the crawl is pointed, e.g. https://www.6figjobs.com: canonicals must stay on this origin. */
  origin: string
  status: number
  inSitemap: boolean
  contentType: string
  contentEncoding: string
  xRobotsTag: string
  bytes: number
  ttfbMs: number
  now?: Date
}

export function isNoindex(facts: PageFacts, ctx: Pick<PageContext, 'xRobotsTag'>): boolean {
  return /\bnoindex\b|\bnone\b/.test(`${facts.metaRobots},${ctx.xRobotsTag.toLowerCase()}`)
}

export function checkPage(facts: PageFacts, ctx: PageContext): Issue[] {
  const out: Issue[] = []
  const kind = pageKind(ctx.url)
  const noindex = isNoindex(facts, ctx)
  const self = normalizeUrl(ctx.url)

  // Delivery
  if (!/text\/html/i.test(ctx.contentType)) out.push(issue('warning', 'non-html-content-type', ctx.contentType))
  if (ctx.ttfbMs > SLOW_RESPONSE_MS) out.push(issue('warning', 'slow-response', `${Math.round(ctx.ttfbMs)} ms`))
  if (ctx.bytes > 5000 && !ctx.contentEncoding) out.push(issue('warning', 'no-compression', `${ctx.bytes} bytes`))
  if (ctx.bytes > MAX_HTML_BYTES) out.push(issue('warning', 'large-html', `${ctx.bytes} bytes`))

  // Indexability
  if (noindex && ctx.inSitemap) out.push(issue('critical', 'noindex-in-sitemap'))
  if (noindex && facts.hreflang.length > 0) out.push(issue('warning', 'hreflang-on-noindex'))
  if (!noindex && facts.hreflang.length > 0 && !facts.hreflang.some((h) => normalizeUrl(h.href, ctx.url) === self)) {
    out.push(issue('warning', 'hreflang-no-self'))
  }

  // Canonical
  if (!noindex) {
    const distinct = [...new Set(facts.canonicals)]
    if (distinct.length === 0) out.push(issue('critical', 'missing-canonical'))
    else if (distinct.length > 1) out.push(issue('critical', 'multiple-canonicals', distinct.join(' | ')))
    else {
      const c = distinct[0]
      if (!/^https?:\/\//i.test(c)) out.push(issue('warning', 'canonical-relative', c))
      const target = normalizeUrl(c, ctx.url)
      if (target && new URL(target).origin !== ctx.origin) out.push(issue('critical', 'canonical-wrong-origin', c))
      else if (target && target !== self) {
        out.push(issue(ctx.inSitemap ? 'critical' : 'info', 'canonical-mismatch', `${ctx.url} -> ${c}`))
      }
    }
  }

  // Titles, descriptions, headings (only for pages meant to be indexed)
  if (!noindex) {
    if (!facts.title) out.push(issue('critical', 'missing-title'))
    else {
      if (facts.title.length > TITLE_MAX) out.push(issue('info', 'title-too-long', `${facts.title.length} chars`))
      if (facts.title.length < TITLE_MIN) out.push(issue('warning', 'title-too-short', facts.title))
    }
    if (facts.titleCount > 1) out.push(issue('warning', 'multiple-titles'))
    if (!facts.description) out.push(issue('warning', 'missing-meta-description'))
    else {
      if (facts.description.length > DESCRIPTION_MAX) {
        out.push(issue('info', 'meta-description-too-long', `${facts.description.length} chars`))
      }
      if (facts.description.length < DESCRIPTION_MIN) {
        out.push(issue('info', 'meta-description-too-short', `${facts.description.length} chars`))
      }
    }
    if (facts.h1Count === 0) out.push(issue('warning', 'missing-h1'))
    if (facts.h1Count > 1) out.push(issue('warning', 'multiple-h1', `${facts.h1Count}`))
    if (facts.headingSkips > 0) out.push(issue('info', 'heading-order-skip', `${facts.headingSkips}`))
    if (facts.wordCount < THIN_WORDS) {
      out.push(issue(kind === 'job' || kind === 'article' ? 'warning' : 'info', 'thin-content', `${facts.wordCount} words`))
    }
    if (!facts.hasOgTitle || !facts.hasOgDescription) out.push(issue('info', 'missing-open-graph'))
    if (!facts.hasOgImage) out.push(issue('info', 'missing-og-image'))
    if (!facts.hasTwitterCard) out.push(issue('info', 'missing-twitter-card'))
  }

  // Technical hygiene
  if (!facts.lang) out.push(issue('warning', 'missing-html-lang'))
  if (!facts.hasViewport) out.push(issue('warning', 'missing-viewport'))
  if (!facts.hasCharset) out.push(issue('info', 'missing-charset'))
  if (facts.imagesMissingAlt > 0) out.push(issue('info', 'images-missing-alt', `${facts.imagesMissingAlt}/${facts.imagesTotal}`))
  if (facts.links.filter((l) => !l.nofollow).length === 0) out.push(issue('warning', 'no-outgoing-links'))

  // Structured data
  facts.jsonLd.filter((b) => b.error).forEach((b) => out.push(issue('critical', 'jsonld-invalid', b.error)))
  const nodes = flattenJsonLd(facts.jsonLd)
  const types = new Set(nodes.flatMap(typesOf))
  if (kind === 'job') {
    const postings = nodes.filter((n) => typesOf(n).includes('JobPosting'))
    if (postings.length === 0) {
      if (!noindex) out.push(issue('critical', 'jp-missing'))
    } else {
      if (postings.length > 1) out.push(issue('warning', 'jp-multiple', `${postings.length}`))
      out.push(...checkJobPosting(postings[0], ctx.now))
    }
    if (!types.has('BreadcrumbList')) out.push(issue('info', 'missing-breadcrumbs'))
  } else if (kind === 'home' && !types.has('WebSite') && !types.has('Organization')) {
    out.push(issue('info', 'home-missing-organization-schema'))
  }
  return out
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* robots.txt                                                                                                        */
/* ----------------------------------------------------------------------------------------------------------------- */

export type RobotsRules = { allow: string[]; disallow: string[]; sitemaps: string[] }

/** The rules for `User-agent: *` plus every Sitemap line. */
export function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [], sitemaps: [] }
  let applies = false
  let inAgentBlock = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (key === 'sitemap') rules.sitemaps.push(value)
    else if (key === 'user-agent') {
      applies = inAgentBlock ? applies || value === '*' : value === '*'
      inAgentBlock = true
    } else {
      inAgentBlock = false
      if (applies && value) (key === 'allow' ? rules.allow : key === 'disallow' ? rules.disallow : []).push(value)
    }
  }
  return rules
}

const patternRegex = (p: string) =>
  new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'))

/** Google's rule: the longest matching pattern wins, and Allow wins a tie. */
export function isAllowedByRobots(rules: RobotsRules, pathAndQuery: string): boolean {
  const longest = (list: string[]) =>
    list.reduce((n, p) => (patternRegex(p).test(pathAndQuery) ? Math.max(n, p.length) : n), -1)
  return longest(rules.allow) >= longest(rules.disallow)
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Numbers                                                                                                           */
/* ----------------------------------------------------------------------------------------------------------------- */

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}
