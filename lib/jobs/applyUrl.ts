// lib/jobs/applyUrl.ts
//
// The public "Apply" button must point at the employer's real application page
// (their own site or ATS posting) — never at a board/aggregator we scraped the
// job from, and never back at ourselves. ATS hosts (Greenhouse, Lever, Ashby,
// …) ARE the real application page, so they are intentionally NOT in this list.

const AGGREGATOR_APPLY_HOSTS = [
  '6figjobs.com',
  'nodesk.co',
  'remote100k.com',
  'builtin.com',
  'remotive.com',
  'remoteyeah.com',
  'dice.com',
  'wellfound.com',
  'otta.com',
  'weworkremotely.com',
  'remoteok.com',
  'himalayas.app',
]

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

// Ad / click-tracking redirectors that wrap the real destination URL. We unwrap
// these to recover the employer/ATS link instead of sending users through an ad
// tracker (e.g. BuiltIn surfaces Capital One jobs as ad.doubleclick.net links
// that embed the real capitalonecareers.com URL).
const REDIRECT_HOSTS = ['doubleclick.net', 'googleadservices.com', 'dartsearch.net']
const REDIRECT_PARAM_KEYS = ['url', 'u', 'dest', 'destination', 'redirect', 'target', 'to', 'adurl']

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Recover the real destination from a click-tracking / ad-redirect URL. Returns
 * the original URL unchanged when it is not a known redirector, so it is safe to
 * call on every apply-URL candidate. Recurses a few levels for nested wrappers.
 */
export function unwrapRedirectUrl(rawUrl: string | null | undefined, depth = 0): string {
  const url = String(rawUrl ?? '').trim()
  if (depth > 3 || !isHttpUrl(url)) return url

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const isRedirector = REDIRECT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  if (!isRedirector) return url

  // doubleclick /ddm/clk/<ids>;f?https://real-destination — the raw URL follows '?'.
  const qIndex = url.indexOf('?')
  if (qIndex !== -1) {
    const after = url.slice(qIndex + 1)
    if (isHttpUrl(after)) return unwrapRedirectUrl(decodeOnce(after), depth + 1)
    if (isHttpUrl(decodeOnce(after))) return unwrapRedirectUrl(decodeOnce(after), depth + 1)
  }

  // Query-param based redirects (?url=, ?adurl=, …).
  for (const key of REDIRECT_PARAM_KEYS) {
    const v = parsed.searchParams.get(key)
    if (!v) continue
    if (isHttpUrl(v)) return unwrapRedirectUrl(v, depth + 1)
    const decoded = decodeOnce(v)
    if (isHttpUrl(decoded)) return unwrapRedirectUrl(decoded, depth + 1)
  }

  return url
}

export function isAggregatorApplyUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const host = hostOf(String(url).trim())
  if (!host) return false
  return AGGREGATOR_APPLY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
}

/**
 * Pick the first candidate that is a valid http(s) URL pointing at a real
 * employer/ATS — skipping any aggregator host. Returns null if none qualify, so
 * the apply button is hidden rather than sending the user to a competitor
 * aggregator. (ATS links pass through — they are the genuine application page.)
 */
export function cleanApplyUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue
    const url = unwrapRedirectUrl(String(candidate).trim())
    if (!/^https?:\/\//i.test(url)) continue
    if (isAggregatorApplyUrl(url)) continue
    return url
  }
  return null
}
