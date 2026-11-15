// lib/scrapers/atsBoards.ts
//
// Finding a company's public job board (Greenhouse, Lever, Ashby, ...) from its name, and proving it is the company's.
// One request to a board's public API returns every posting with its text, which is why a known board is so much cheaper
// than any crawl. The approach is FTJA's (github.com/TaegyuJEONG/ftja, MIT: ftja/ats.py; see THIRD_PARTY_NOTICES.md):
//
//  - guess board names from the company name ("Acme Labs GmbH" -> acme-labs, acmelabs, acme);
//  - try each guess on each vendor's public API and keep one that lists postings;
//  - a guessed board name can belong to ANOTHER company, so a guess is only trusted ("confirmed") when the board has a
//    posting whose title matches one we already hold for that company. An unconfirmed hit is reported, never saved.
//
// Only public, unauthenticated board APIs are called. Workday, iCIMS and the like are not here: their boards are read one
// posting at a time and differently per company. No database access: callers inject what they know.
import { normalizeTitleForMatch } from '../ingest/dedupeHelpers'

export type BoardVendor = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters' | 'recruitee' | 'teamtailor' | 'bamboohr'

/** Vendors in the order they are tried for a guessed name. BambooHR names cannot be guessed reliably, so it is seed-only. */
export const PROBED_VENDORS: readonly BoardVendor[] = ['greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'recruitee', 'teamtailor']

export const ALL_BOARD_VENDORS: readonly BoardVendor[] = [...PROBED_VENDORS, 'bamboohr']

/** Teamtailor and BambooHR boards are whole hostnames; the others are a name in a path or subdomain. */
const HOST_VENDORS: ReadonlySet<BoardVendor> = new Set(['teamtailor', 'bamboohr'])

const SLUG_RE: Record<BoardVendor, RegExp> = {
  greenhouse: /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/,
  lever: /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/,
  ashby: /^[A-Za-z0-9][A-Za-z0-9._%-]{0,99}$/,
  workable: /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/,
  smartrecruiters: /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/,
  recruitee: /^[a-z0-9][a-z0-9-]{0,62}$/,
  teamtailor: /^[a-z0-9-]+\.teamtailor\.com$/,
  bamboohr: /^[a-z0-9-]+\.bamboohr\.com$/,
}

export function isValidBoard(vendor: string, slug: string): vendor is BoardVendor {
  return (ALL_BOARD_VENDORS as readonly string[]).includes(vendor) && SLUG_RE[vendor as BoardVendor].test(String(slug ?? ''))
}

/** The company's name as compared: case, punctuation and corporate suffixes ("GmbH", "Inc") left out. */
export function companyKey(name: string | null | undefined): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(gmbh|ag|se|inc|ltd|llc|limited|group|co|kgaa|plc|sa|sas|bv)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Board names a company is likely to use: "Acme Labs GmbH" -> acme-labs-gmbh, acmelabsgmbh, acme-labs, acmelabs. */
export function boardSlugGuesses(name: string | null | undefined): string[] {
  const base = String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const trimmed = base.replace(/-(gmbh|ag|se|inc|ltd|llc|group|technologies|technology|labs|io|hq)$/, '')
  return [...new Set([base, base.replace(/-/g, ''), trimmed, trimmed.replace(/-/g, '')])].filter(Boolean)
}

/** The URL a `CompanyATS` / `Company.atsUrl` row holds for a board, in the form lib/scrapers/ats reads. */
export function boardUrl(vendor: BoardVendor, slug: string): string {
  switch (vendor) {
    case 'greenhouse':
      return `https://boards.greenhouse.io/${slug}`
    case 'lever':
      return `https://jobs.lever.co/${slug}`
    case 'ashby':
      return `https://jobs.ashbyhq.com/${slug}`
    case 'workable':
      return `https://apply.workable.com/${slug}`
    case 'smartrecruiters':
      return `https://jobs.smartrecruiters.com/${slug}`
    case 'recruitee':
      return `https://${slug}.recruitee.com`
    default:
      return `https://${slug}`
  }
}

function apiUrl(vendor: BoardVendor, slug: string): string {
  switch (vendor) {
    case 'greenhouse':
      return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`
    case 'lever':
      return `https://api.lever.co/v0/postings/${slug}?mode=json`
    case 'ashby':
      return `https://api.ashbyhq.com/posting-api/job-board/${slug}`
    case 'workable':
      return `https://apply.workable.com/api/v1/widget/accounts/${slug}`
    case 'smartrecruiters':
      return `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`
    case 'recruitee':
      return `https://${slug}.recruitee.com/api/offers/`
    case 'teamtailor':
      return `https://${slug}/jobs.rss`
    default:
      return `https://${slug}/careers/list`
  }
}

type Json = Record<string, any> | any[] | null

/** The posting titles in a vendor's list response (JSON already parsed, or the RSS text for Teamtailor). */
export function titlesFrom(vendor: BoardVendor, body: Json | string): string[] {
  const pick = (rows: unknown, key: string): string[] =>
    (Array.isArray(rows) ? rows : []).map((r) => (r && typeof r === 'object' ? String((r as any)[key] ?? '') : '')).filter(Boolean)
  if (vendor === 'teamtailor') {
    return typeof body === 'string' ? [...body.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)].map((m) => m[1].trim()) : []
  }
  const data = body && typeof body === 'object' ? (body as any) : {}
  switch (vendor) {
    case 'greenhouse':
    case 'ashby':
    case 'workable':
      return pick(data.jobs, 'title')
    case 'lever':
      return pick(Array.isArray(body) ? body : [], 'text')
    case 'smartrecruiters':
      return pick(data.content, 'name')
    case 'recruitee':
      return pick(data.offers, 'title')
    default:
      return pick(data.result, 'jobOpeningName')
  }
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

const TIMEOUT_MS = 15_000
const HEADERS = { 'User-Agent': 'SixFigureJobs/1.0 (+board-discovery)', Accept: 'application/json' }

/** Every posting title on a board, from one request; [] when the board does not exist, is empty, or does not answer. */
export async function boardTitles(vendor: BoardVendor, slug: string, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<string[]> {
  if (!isValidBoard(vendor, slug)) return []
  try {
    const res = await fetchImpl(apiUrl(vendor, slug), { signal: AbortSignal.timeout(TIMEOUT_MS), headers: HEADERS })
    if (!res.ok) return []
    const text = await res.text()
    return titlesFrom(vendor, vendor === 'teamtailor' ? text : (JSON.parse(text) as Json))
  } catch {
    return []
  }
}

export type BoardMatch = {
  vendor: BoardVendor
  slug: string
  url: string
  postings: number
  /** True when a posting on the board has the same title (gender notes and case aside) as one we already hold for the company. */
  confirmed: boolean
}

/**
 * The first guessed board that lists postings. `knownTitles` are titles we already hold for this company from other
 * sources: with them, a board is `confirmed` only if it lists one of them. A confirmed board is preferred over an
 * earlier unconfirmed one. Returns null when no guess lists any posting.
 */
export async function probeBoard(
  companyName: string,
  knownTitles: readonly string[] = [],
  fetchImpl?: FetchLike,
): Promise<BoardMatch | null> {
  const known = new Set(knownTitles.map(normalizeTitleForMatch).filter(Boolean))
  let unconfirmed: BoardMatch | null = null
  for (const guess of boardSlugGuesses(companyName)) {
    for (const vendor of PROBED_VENDORS) {
      const slug = HOST_VENDORS.has(vendor) ? `${guess}.teamtailor.com` : guess
      const titles = await boardTitles(vendor, slug, fetchImpl)
      if (!titles.length) continue
      const match: BoardMatch = {
        vendor,
        slug,
        url: boardUrl(vendor, slug),
        postings: titles.length,
        confirmed: titles.some((t) => known.has(normalizeTitleForMatch(t))),
      }
      if (match.confirmed) return match
      unconfirmed ??= match
    }
  }
  return unconfirmed
}
