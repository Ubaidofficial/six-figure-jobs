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
    const url = String(candidate).trim()
    if (!/^https?:\/\//i.test(url)) continue
    if (isAggregatorApplyUrl(url)) continue
    return url
  }
  return null
}
