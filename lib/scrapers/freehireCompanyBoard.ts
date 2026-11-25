// lib/scrapers/freehireCompanyBoard.ts
//
// What freehire knows about one company, by name: whether it covers it, how many jobs it lists, and the employer's own
// ATS board. A freehire job's `url` is the employer's own posting (jobs.ashbyhq.com/fireworks/<id>), so the board a
// company posts on can be read from its jobs with no crawl of the company's website. No database access.
import { companyKey, boardSlugGuesses } from './atsBoards'
import { freehireHeaders } from './freehire'
import { detectAtsFromUrl } from '../normalizers/ats'

const COMPANY_URL = 'https://freehire.me/api/v1/companies'
// /data/ search: the public search leaves `url` (the employer link this reads the board from) empty since 2026-11-25.
const SEARCH_URL = 'https://freehire.me/api/v1/data/jobs/search'
const SAMPLE_JOBS = 5

export type FreehireCompany = {
  slug: string
  name: string
  jobCount: number
  website: string | null
  /** The employer's own ATS board read from its jobs' links, or null (aggregator links, an unsupported ATS, no jobs). */
  board: { provider: string; url: string } | null
}

/** freehire's slug for "Fal.ai" is fal-ai and for "Applied Intuition" applied-intuition: the board guesses plus dots as hyphens. */
export function freehireSlugGuesses(name: string): string[] {
  const dotted = String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return [...new Set([dotted, ...boardSlugGuesses(name)])].filter(Boolean)
}

/** The ATS board most of these job links point to (aggregator and unsupported links are ignored), or null. */
export function boardFromJobUrls(urls: readonly string[]): { provider: string; url: string } | null {
  const tally = new Map<string, { provider: string; url: string; n: number }>()
  for (const u of urls) {
    const hit = detectAtsFromUrl(String(u ?? ''))
    if (!hit) continue
    const entry = tally.get(hit.atsUrl) ?? { provider: hit.provider, url: hit.atsUrl, n: 0 }
    entry.n++
    tally.set(hit.atsUrl, entry)
  }
  const best = [...tally.values()].sort((a, b) => b.n - a.n)[0]
  return best ? { provider: best.provider, url: best.url } : null
}

type GetJson = (url: string) => Promise<any | null>

function politeGetJson(gapMs: number, fetchImpl: typeof fetch): GetJson {
  let last = 0
  return async (url) => {
    const wait = last + gapMs - Date.now()
    if (last && wait > 0) await new Promise((r) => setTimeout(r, wait))
    last = Date.now()
    const res = await fetchImpl(url, { headers: freehireHeaders(), signal: AbortSignal.timeout(20_000) })
    if (res.status === 429) throw new Error('freehire rate limit (429): stopping')
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined)
      return null
    }
    return res.json()
  }
}

/**
 * freehire's record of the company called `name`, or null when it has none. A slug guess is accepted only when
 * freehire's own company name is the same name, so "Gamma" cannot resolve to another company that shares the slug.
 */
export async function lookupFreehireCompany(
  name: string,
  opts: { fetchImpl?: typeof fetch; gapMs?: number } = {},
): Promise<FreehireCompany | null> {
  const get = politeGetJson(opts.gapMs ?? 700, opts.fetchImpl ?? fetch)
  for (const guess of freehireSlugGuesses(name)) {
    const company = (await get(`${COMPANY_URL}/${encodeURIComponent(guess)}`))?.data?.company
    if (!company || companyKey(company.name).replace(/ /g, '') !== companyKey(name).replace(/ /g, '')) continue
    const jobs = (await get(`${SEARCH_URL}?company_slug=${encodeURIComponent(company.slug)}&limit=${SAMPLE_JOBS}`))?.data
    const website = company.company_info?.website
    return {
      slug: String(company.slug),
      name: String(company.name),
      jobCount: Number(company.job_count) || 0,
      website: typeof website === 'string' && website ? website : null,
      board: boardFromJobUrls((Array.isArray(jobs) ? jobs : []).map((j: any) => j?.url)),
    }
  }
  return null
}
