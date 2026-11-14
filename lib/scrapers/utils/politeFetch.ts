// lib/scrapers/utils/politeFetch.ts
//
// One HTTP getter for scrapers of single job sites: an honest User-Agent, a minimum gap between requests, a timeout,
// and a hard stop (SourceBlocked) at the first 401/403/429. Nothing retries or works around a block: a site that
// refuses a bot has made its choice, and the scraper ends the run.

export class SourceBlocked extends Error {}

export type Getter = (url: string) => Promise<string | null>

type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal; redirect: 'follow' }) => Promise<{ status: number; text(): Promise<string> }>

export const BOT_USER_AGENT = 'SixFigureJobsBot/1.0 (+https://www.6figjobs.com)'

/** A getter returning the body, or null for a 404 or other non-blocking error status. Throws SourceBlocked on 401/403/429. */
export function makePoliteGetter(opts: { gapMs: number; fetchImpl?: FetchLike; sleep?: (ms: number) => Promise<void> }): Getter {
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init))
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  let last = 0
  return async (url) => {
    const wait = last + opts.gapMs - Date.now()
    if (last && wait > 0) await sleep(wait)
    last = Date.now()
    const res = await fetchImpl(url, { headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'text/html,application/xml' }, signal: AbortSignal.timeout(25_000), redirect: 'follow' })
    if (res.status === 401 || res.status === 403 || res.status === 429) throw new SourceBlocked(`HTTP ${res.status} from ${new URL(url).hostname}`)
    if (res.status >= 400) return null
    return res.text()
  }
}
