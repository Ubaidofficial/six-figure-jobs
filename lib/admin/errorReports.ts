// Browser error reports (ErrorLog, sent by components/ErrorTracker.tsx): which ones are noise, and how reports of the
// same error are grouped for the admin console. Found 2026-11-24: 633 reports listed one by one, most of them the same
// two messages repeated, so a new error could not be seen among them.

/**
 * Errors that are not the site's bugs: browser warnings the spec says to ignore, errors raised inside browser
 * extensions, and cross-origin script errors with no detail. They are not stored, and old ones are listed apart.
 */
const NOISE_MESSAGES = [
  // Chrome/Firefox report a ResizeObserver callback that queued another layout; harmless (W3C resize-observer spec).
  /ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i,
  // A script from another origin threw; the browser hides everything else, so there is nothing to act on.
  /^Script error\.?$/i,
]
const EXTENSION_SOURCE = /(chrome|moz|safari(-web)?)-extension:\/\//i

export function isNoiseError(message: string, stack?: string | null, filename?: string | null): boolean {
  if (NOISE_MESSAGES.some((re) => re.test(message.trim()))) return true
  return EXTENSION_SOURCE.test(stack ?? '') || EXTENSION_SOURCE.test(filename ?? '')
}

/** Reports with the same key are one issue: long numbers (ids, line numbers, timestamps) are not part of the key. */
export function errorGroupKey(message: string): string {
  return message.trim().replace(/\d{3,}/g, '#').replace(/\s+/g, ' ').slice(0, 300)
}

/** The page a report came from, without its query string ("/jobs", "/job/some-slug"). */
export function errorPagePath(url: string | null | undefined): string {
  if (!url) return '(unknown page)'
  try {
    return new URL(url).pathname
  } catch {
    return url.split('?')[0]
  }
}

/** A coarse browser name from a user agent, for "which browsers see this". Order matters: Edge and Opera say Chrome. */
export function browserFamily(userAgent: string | null | undefined): string {
  const ua = userAgent ?? ''
  if (!ua) return 'Unknown'
  if (/bot|crawler|spider|headless/i.test(ua)) return 'Bot'
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\/|Opera/.test(ua)) return 'Opera'
  if (/SamsungBrowser/.test(ua)) return 'Samsung'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Chrome\//.test(ua) || /CriOS\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'Other'
}

export type ErrorReportRow = {
  id: string
  message: string
  stack: string | null
  url: string | null
  userAgent: string | null
  status: string
  createdAt: Date
}

export type ErrorGroup = {
  key: string
  message: string
  count: number
  newCount: number
  firstSeen: Date
  lastSeen: Date
  noise: boolean
  pages: Array<{ path: string; count: number }>
  browsers: Array<{ name: string; count: number }>
  latestStack: string | null
  latestUrl: string | null
}

function top(counts: Map<string, number>, n: number) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

/** Groups reports (any order) into issues, the most recently seen first. */
export function groupErrorReports(rows: ErrorReportRow[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup & { pageCounts: Map<string, number>; browserCounts: Map<string, number> }>()
  for (const r of rows) {
    const key = errorGroupKey(r.message)
    let g = groups.get(key)
    if (!g) {
      g = {
        key,
        message: r.message,
        count: 0,
        newCount: 0,
        firstSeen: r.createdAt,
        lastSeen: r.createdAt,
        noise: isNoiseError(r.message, r.stack),
        pages: [],
        browsers: [],
        latestStack: r.stack,
        latestUrl: r.url,
        pageCounts: new Map(),
        browserCounts: new Map(),
      }
      groups.set(key, g)
    }
    g.count++
    if (r.status === 'new') g.newCount++
    if (r.createdAt < g.firstSeen) g.firstSeen = r.createdAt
    if (r.createdAt >= g.lastSeen) {
      g.lastSeen = r.createdAt
      g.message = r.message
      g.latestStack = r.stack ?? g.latestStack
      g.latestUrl = r.url
    }
    const path = errorPagePath(r.url)
    g.pageCounts.set(path, (g.pageCounts.get(path) ?? 0) + 1)
    const browser = browserFamily(r.userAgent)
    g.browserCounts.set(browser, (g.browserCounts.get(browser) ?? 0) + 1)
  }
  return [...groups.values()]
    .map(({ pageCounts, browserCounts, ...g }) => ({
      ...g,
      pages: top(pageCounts, 5).map(([path, count]) => ({ path, count })),
      browsers: top(browserCounts, 4).map(([name, count]) => ({ name, count })),
    }))
    .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
}
