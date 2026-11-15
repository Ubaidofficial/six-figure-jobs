import { guardJobPage, guardUiApi, isAutomationUserAgent, rateLimited } from '@/lib/security/scrapeGuard'

const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const req = (headers: Record<string, string>, url = 'https://www.6figjobs.com/api/jobs') => new Request(url, { headers })

afterEach(() => {
  delete process.env.API_GUARD
  delete process.env.SCRAPE_GUARD_PER_MINUTE
  delete process.env.SCRAPE_GUARD_IP_HOPS
})

describe('isAutomationUserAgent', () => {
  it('flags command-line tools, HTTP libraries, headless browsers and an empty User-Agent', () => {
    for (const ua of ['curl/8.5.0', 'python-requests/2.31.0', 'Go-http-client/1.1', 'Scrapy/2.11 (+https://scrapy.org)', 'axios/1.6.0', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)', 'Mozilla/5.0 HeadlessChrome/120.0.0.0 Safari/537.36', 'okhttp/4.12.0', 'Java/17.0.1', '']) {
      expect({ ua, blocked: isAutomationUserAgent(ua) }).toEqual({ ua, blocked: true })
    }
    expect(isAutomationUserAgent(null)).toBe(true)
  })
  it('lets browsers, search engines and link previews through', () => {
    for (const ua of [
      BROWSER,
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 (compatible; Googlebot/2.1)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)',
      'Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)',
    ]) {
      expect({ ua, blocked: isAutomationUserAgent(ua) }).toEqual({ ua, blocked: false })
    }
  })
})

describe('guardUiApi', () => {
  it('lets the site\'s own pages call it (Sec-Fetch-Site, or a Referer from this site on older browsers)', () => {
    expect(guardUiApi(req({ 'user-agent': BROWSER, 'sec-fetch-site': 'same-origin' }))).toBeNull()
    expect(guardUiApi(req({ 'user-agent': BROWSER, referer: 'https://www.6figjobs.com/jobs?page=2' }))).toBeNull()
  })
  it('refuses scripts, other websites, and requests with no sign of coming from a page', () => {
    expect(guardUiApi(req({ 'user-agent': 'curl/8.5.0', 'sec-fetch-site': 'same-origin' }))?.status).toBe(403)
    expect(guardUiApi(req({ 'user-agent': BROWSER, 'sec-fetch-site': 'cross-site' }))?.status).toBe(403)
    expect(guardUiApi(req({ 'user-agent': BROWSER }))?.status).toBe(403)
    expect(guardUiApi(req({ 'user-agent': BROWSER, referer: 'https://scraper.example/page' }))?.status).toBe(403)
  })
  it('does nothing when API_GUARD=off', () => {
    process.env.API_GUARD = 'off'
    expect(guardUiApi(req({ 'user-agent': 'curl/8.5.0' }))).toBeNull()
  })
})

describe('guardJobPage', () => {
  const page = (ua: string, path = '/jobs/software-engineer') => guardJobPage(req({ 'user-agent': ua }, `https://www.6figjobs.com${path}`), path)
  it('blocks scraping libraries on job data pages only', () => {
    expect(page('python-requests/2.31.0')?.status).toBe(403)
    expect(page('python-requests/2.31.0', '/job/abc123-xyz')?.status).toBe(403)
    expect(page('python-requests/2.31.0', '/company/stripe')?.status).toBe(403)
    expect(page('curl/8.5.0', '/api/health')).toBeNull()
    expect(page('curl/8.5.0', '/sitemap.xml')).toBeNull()
    expect(page('curl/8.5.0', '/robots.txt')).toBeNull()
    expect(page('curl/8.5.0', '/')).toBeNull()
  })
  it('never blocks a browser or a search engine', () => {
    expect(page(BROWSER)).toBeNull()
    expect(page('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', '/job/abc')).toBeNull()
  })
})

describe('rateLimited', () => {
  it('is off until SCRAPE_GUARD_PER_MINUTE is set, then answers 429 past the limit for one address', () => {
    const r = () => req({ 'user-agent': BROWSER, 'x-forwarded-for': '198.51.100.7' })
    for (let i = 0; i < 5; i += 1) expect(rateLimited(r())).toBeNull()
    process.env.SCRAPE_GUARD_PER_MINUTE = '3'
    const results = [0, 1, 2, 3, 4].map(() => rateLimited(r())?.status ?? 200)
    expect(results).toEqual([200, 200, 200, 429, 429])
    // another address has its own budget
    expect(rateLimited(req({ 'user-agent': BROWSER, 'x-forwarded-for': '198.51.100.8' }))).toBeNull()
  })
})
