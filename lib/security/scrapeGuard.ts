// lib/security/scrapeGuard.ts
//
// Cheap brakes on bulk scraping of the job data. What they are and are not: the pages must stay readable by Google and
// by visitors, so anyone who copies a browser's headers can still read them one at a time. These stop the lazy and the
// fast: command-line tools and scraping libraries (by their own User-Agent), other websites' scripts calling the JSON
// the site's own pages use, and one address pulling thousands of pages a minute. A scraper that spoofs a browser and
// goes slowly is not stopped by anything in the app; that takes a bot filter in front of it (Cloudflare).
//
// Never applied to: search-engine and link-preview crawlers (by User-Agent, which a scraper can copy: see above),
// sitemaps, robots.txt, llms.txt, /api/health, /api/mcp (public by design, with its own limit) or /api/jobs/latest.
// API_GUARD=off turns every check here off without a deploy of code (set the variable and restart).
import { createHash } from 'node:crypto'

import { clientIp } from '@/lib/auth/signInRateLimit'
import { createRateLimiter } from '@/lib/jobs/jobReport'
import { SITE_HOSTS } from '@/lib/seo/site'

/** Command-line tools, HTTP client libraries and headless browsers that identify themselves as such. */
const AUTOMATION_UA =
  /\b(?:python-requests|python-urllib|python-httpx|httpx|aiohttp|scrapy|curl|wget|libwww-perl|go-http-client|okhttp|java|apache-httpclient|node-fetch|axios|got|undici|headlesschrome|phantomjs|selenium|puppeteer|playwright|httpie|postmanruntime|insomnia|colly|mechanize|jsdom|crawler4j|jakarta|restsharp|guzzlehttp)(?:[\/\s;)]|$)/i

/** Crawlers that bring visitors or previews. Let through whatever else is checked. */
const WELCOME_BOT_UA =
  /(?:googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|bingbot|bingpreview|msnbot|duckduckbot|applebot|yandex(?:bot)?|baiduspider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|pinterest|embedly|oai-searchbot|perplexitybot|claude-user|chatgpt-user|uptimerobot|pingdom|statuscake|betterstack|betteruptime)/i

export function isAutomationUserAgent(ua: string | null | undefined): boolean {
  const value = (ua ?? '').trim()
  if (!value) return true // every browser and every honest crawler sends one
  if (WELCOME_BOT_UA.test(value)) return false
  return AUTOMATION_UA.test(value)
}

const guardOff = () => process.env.API_GUARD === 'off'

const forbidden = () =>
  new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

const sameSiteHost = (value: string | null): boolean => {
  if (!value) return false
  try {
    const host = new URL(value).hostname.toLowerCase()
    return (SITE_HOSTS as readonly string[]).includes(host) || host === 'localhost'
  } catch {
    return false
  }
}

/**
 * For JSON endpoints that exist only for the site's own pages (the job list's "load more", search suggestions, a
 * company's "show more"): a browser running our pages always sends Sec-Fetch-Site (same-origin) or a Referer from this
 * site. Anything else is a script or another website. Returns a 403 Response to send, or null to carry on.
 */
export function guardUiApi(req: Request): Response | null {
  if (guardOff()) return null
  const h = req.headers
  if (isAutomationUserAgent(h.get('user-agent'))) return forbidden()

  const fetchSite = h.get('sec-fetch-site')
  if (fetchSite) {
    if (fetchSite !== 'same-origin' && fetchSite !== 'same-site') return forbidden()
  } else if (!sameSiteHost(h.get('origin')) && !sameSiteHost(h.get('referer'))) {
    return forbidden()
  }

  return rateLimited(req)
}

const limiter = createRateLimiter()

/**
 * Optional brake per client address, for the HTML and JSON pages that carry job data. Off until
 * SCRAPE_GUARD_PER_MINUTE is set: it keys on the address the proxy reports (SCRAPE_GUARD_IP_HOPS proxies in front,
 * default 1), and if that count is wrong every visitor would share one address and one budget.
 */
export function rateLimited(req: Request): Response | null {
  const perMinute = Number(process.env.SCRAPE_GUARD_PER_MINUTE)
  if (!Number.isFinite(perMinute) || perMinute <= 0 || guardOff()) return null
  const hops = Number(process.env.SCRAPE_GUARD_IP_HOPS)
  const ip = clientIp(req.headers, Number.isInteger(hops) && hops > 0 ? hops : 1)
  const key = createHash('sha256').update(`sfj-scrape:${ip}`).digest('hex').slice(0, 24)
  if (limiter.allow(key, perMinute, 60_000)) return null
  return new Response(JSON.stringify({ error: 'too many requests' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '60' },
  })
}

/** Page paths that carry job data in bulk. Everything else (home, blog, legal, sitemaps, files) is never blocked here. */
export const JOB_DATA_PAGE = /^\/(?:jobs|job|company|companies|remote|salary)(?:\/|$)/

/** For the proxy: a 403 for a page request from a command-line tool or scraping library, else null. */
export function guardJobPage(req: Request, pathname: string): Response | null {
  if (guardOff() || !JOB_DATA_PAGE.test(pathname)) return null
  const ua = req.headers.get('user-agent')
  if (WELCOME_BOT_UA.test(ua ?? '')) return null // search engines and previews are never throttled here
  if (isAutomationUserAgent(ua)) {
    return new Response('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } })
  }
  return rateLimited(req)
}
