// "Check employer" in the admin Review queue: is the job still open where it was posted? A hint for the owner, never a
// verdict the site acts on: nothing here expires a job. Two sources:
//  - freehire jobs: freehire's own record (`closed_at`), the lookup the closed-job check uses (lib/scrapers/freehireClosedCheck.ts);
//  - every job with an apply link: the employer's page, fetched from the server. A 404/410, a redirect away from the
//    job (Greenhouse sends a closed job to the board with `?error=true`), or a page that says the job closed counts
//    as closed. A page that loads proves little: many career sites (Workday, Ashby) draw the job with JavaScript.
// The apply link comes from third-party data, so the fetch refuses anything but http(s) on a public address, checked on
// every redirect hop and at connection time (the resolved address, so a name cannot point inside the network).
import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

export type CheckVerdict = 'closed' | 'open' | 'unknown'
export type EmployerCheck = { verdict: CheckVerdict; lines: string[] }
export type PageResult = { status: number; finalUrl: string; text: string } | { error: string }
export type PageFetcher = (url: string) => Promise<PageResult>

const MAX_REDIRECTS = 5
const MAX_BYTES = 600_000
const TIMEOUT_MS = 10_000

// Lower case, matched in the page's visible text. Phrases employers' career sites use for a closed or removed job.
const CLOSED_PHRASES = [
  'no longer accepting applications',
  'no longer accepting applicants',
  'job is no longer available',
  'position is no longer available',
  'this job is no longer',
  'this position has been filled',
  'position has been filled',
  'this job has expired',
  'job posting has expired',
  'this posting has closed',
  'this job has been closed',
  'this position is closed',
  'job you are looking for is no longer',
  'the job you are looking for',
  'job not found',
  'this job is closed',
  'no longer open',
]

/** Whether an IP address is private, loopback, link-local or otherwise not on the public internet. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  if (net.isIPv4(v4)) {
    const [a, b] = v4.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    )
  }
  const x = ip.toLowerCase()
  return x === '::' || x === '::1' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe8') || x.startsWith('fe9') ||
    x.startsWith('fea') || x.startsWith('feb') || x.startsWith('ff')
}

/** The URL if it may be fetched (http or https, no credentials, not an address on a private network); else null. */
export function publicHttpUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return null
  if (net.isIP(host) && isPrivateAddress(host)) return null
  return url
}

// Resolves like the default, but refuses a name that resolves to a private address (checked on the addresses the
// connection will use). Node asks for every address at once (`all: true`, to try IPv4 and IPv6) or for one.
const guardedLookup = ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err)
    const list = Array.isArray(address) ? address.map((a) => a.address) : [address as string]
    if (list.some(isPrivateAddress)) return callback(new Error(`refused: ${hostname} resolves to a private address`))
    callback(null, address, family)
  })
}) as unknown as net.LookupFunction

function requestOnce(url: URL): Promise<{ status: number; location: string | null; text: string }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http
    const req = lib.request(
      url,
      {
        method: 'GET',
        lookup: guardedLookup,
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; job-check)', Accept: 'text/html,*/*;q=0.5' },
      },
      (res) => {
        const status = res.statusCode ?? 0
        const location = typeof res.headers.location === 'string' ? res.headers.location : null
        if (status >= 300 && status < 400) {
          res.resume()
          return resolve({ status, location, text: '' })
        }
        let size = 0
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => {
          size += c.length
          if (size > MAX_BYTES) return res.destroy()
          chunks.push(c)
        })
        const done = () => resolve({ status, location, text: Buffer.concat(chunks).toString('utf8') })
        res.on('end', done)
        res.on('close', done)
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('timed out')))
    req.on('error', reject)
    req.end()
  })
}

/** Fetches a page, following redirects itself so every hop is checked. */
export const fetchPublicPage: PageFetcher = async (raw) => {
  let url = publicHttpUrl(raw)
  if (!url) return { error: 'not a public web address' }
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await requestOnce(url)
      if (res.status >= 300 && res.status < 400 && res.location) {
        const next = publicHttpUrl(new URL(res.location, url).toString())
        if (!next) return { error: `redirected to an address that is not checked (${res.location.slice(0, 120)})` }
        url = next
        continue
      }
      return { status: res.status, finalUrl: url.toString(), text: res.text }
    }
    return { error: 'too many redirects' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** What the employer's page says about the job. */
export function readEmployerPage(requested: string, page: PageResult): EmployerCheck {
  if ('error' in page) return { verdict: 'unknown', lines: [`Employer page not checked: ${page.error}.`] }
  const { status, finalUrl } = page
  if (status === 404 || status === 410) return { verdict: 'closed', lines: [`The employer's page answers ${status}: the job is gone.`] }
  if (status >= 400) return { verdict: 'unknown', lines: [`The employer's page answers ${status} (it may block automated checks). Open it to see.`] }
  const from = new URL(requested)
  const to = new URL(finalUrl)
  if (to.searchParams.get('error') === 'true') {
    return { verdict: 'closed', lines: [`The employer's site sent the job to ${to.host}${to.pathname} with an error: it is closed (Greenhouse does this).`] }
  }
  const phrase = CLOSED_PHRASES.find((p) => visibleText(page.text).includes(p))
  if (phrase) return { verdict: 'closed', lines: [`The employer's page says “${phrase}”.`] }
  // Sent somewhere else on a shorter path: usually the careers home after a job is taken down.
  if (to.host !== from.host || (to.pathname !== from.pathname && to.pathname.length < from.pathname.length)) {
    return { verdict: 'closed', lines: [`The job link now redirects to ${to.host}${to.pathname}: usually the careers page after a job closes.`] }
  }
  return {
    verdict: 'open',
    lines: ['The employer’s page loads and does not say the job closed. Some career sites draw the job with JavaScript, so open it to be sure.'],
  }
}

export type FreehireLookup = (slug: string) => Promise<{ state: 'open' } | { state: 'closed'; closedAt: string } | { state: 'gone' } | { state: 'error'; message: string }>

export async function checkEmployer(
  job: { applyUrl: string | null; url: string | null; freehireSlug: string | null },
  deps: { fetchPage?: PageFetcher; lookupFreehire?: FreehireLookup } = {},
): Promise<EmployerCheck> {
  const lines: string[] = []
  const verdicts: CheckVerdict[] = []
  if (job.freehireSlug && deps.lookupFreehire) {
    const f = await deps.lookupFreehire(job.freehireSlug)
    if (f.state === 'closed') {
      verdicts.push('closed')
      lines.push(`freehire marks it closed (${f.closedAt.slice(0, 10)}).`)
    } else if (f.state === 'open') {
      verdicts.push('open')
      lines.push('freehire lists it as open.')
    } else {
      verdicts.push('unknown')
      lines.push(f.state === 'gone' ? 'freehire has no record of it any more.' : `freehire not reached: ${f.message}.`)
    }
  }
  const link = job.applyUrl ?? job.url
  if (link) {
    const page = readEmployerPage(link, publicHttpUrl(link) ? await (deps.fetchPage ?? fetchPublicPage)(link) : { error: 'not a public web address' })
    verdicts.push(page.verdict)
    lines.push(...page.lines)
  } else if (verdicts.length === 0) {
    lines.push('No apply link stored, so there is no employer page to check.')
  }
  const verdict: CheckVerdict = verdicts.includes('closed') ? 'closed' : verdicts.includes('open') ? 'open' : 'unknown'
  return { verdict, lines }
}
