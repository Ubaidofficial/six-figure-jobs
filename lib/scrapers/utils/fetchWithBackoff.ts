// lib/scrapers/utils/fetchWithBackoff.ts
//
// Shared scraper fetch helper that:
//   - enforces a per-request timeout via AbortController
//   - honors HTTP 429 / 503 Retry-After headers (seconds OR HTTP date)
//   - applies exponential backoff on other 5xx and network errors
//   - returns the final successful Response (caller parses JSON/HTML/etc.)
//
// Why this exists: ATS providers throttle bursty scrapers (e.g., Lever, Ashby,
// Greenhouse). Before, individual scrapers used either ad-hoc linear delays or
// no retry at all, and none of them parsed Retry-After. Result: 429s caused
// silent job loss on the affected company that day. Centralizing the policy
// makes every scraper rate-limit-aware with one change.

export type FetchWithBackoffOptions = {
  attempts?: number
  timeoutMs?: number
  baseDelayMs?: number
  maxDelayMs?: number
  // Caller-supplied logger so we can tag log lines per-scraper without
  // pulling in a logger dep.
  onRetry?: (info: RetryInfo) => void
  // Forwarded to fetch.
  method?: string
  headers?: Record<string, string>
  body?: BodyInit | null
  signal?: AbortSignal
}

export type RetryInfo = {
  url: string
  attempt: number
  attempts: number
  delayMs: number
  reason: string
}

const DEFAULTS = {
  attempts: 4,
  timeoutMs: 15_000,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
}

const DEFAULT_USER_AGENT = 'SixFigureJobs/1.0 (+job-board-scraper)'

function parseRetryAfter(header: string | null, nowMs: number = Date.now()): number | null {
  if (!header) return null
  const trimmed = header.trim()
  if (!trimmed) return null

  // Case 1: integer seconds
  const seconds = Number(trimmed)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000)
  }

  // Case 2: HTTP date — server tells us "wait until this absolute time"
  const dateMs = Date.parse(trimmed)
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - nowMs)
  }

  return null
}

function exponentialBackoff(attempt: number, base: number, cap: number): number {
  return Math.min(cap, base * Math.pow(2, attempt))
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error('aborted'))
    const id = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id)
        reject(signal.reason ?? new Error('aborted'))
      },
      { once: true },
    )
  })
}

export async function fetchWithBackoff(
  url: string,
  options: FetchWithBackoffOptions = {},
): Promise<Response> {
  const attempts = options.attempts ?? DEFAULTS.attempts
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs
  const baseDelayMs = options.baseDelayMs ?? DEFAULTS.baseDelayMs
  const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': DEFAULT_USER_AGENT,
    ...(options.headers ?? {}),
  }

  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    // Compose external + timeout signals — abort if either fires.
    const externalAbort = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener('abort', externalAbort, { once: true })

    try {
      const res = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body,
        cache: 'no-store',
        signal: controller.signal,
      })

      // Honor Retry-After on 429 (rate-limited) and 503 (service unavailable).
      if (res.status === 429 || res.status === 503) {
        const retryAfterMs = parseRetryAfter(res.headers.get('retry-after'))
        const delay = retryAfterMs ?? exponentialBackoff(attempt, baseDelayMs, maxDelayMs)
        if (attempt < attempts - 1) {
          options.onRetry?.({
            url,
            attempt: attempt + 1,
            attempts,
            delayMs: delay,
            reason: `HTTP ${res.status}${retryAfterMs != null ? ' (Retry-After honored)' : ''}`,
          })
          // Drain body to free the connection before sleeping.
          await res.body?.cancel().catch(() => {})
          await sleep(Math.min(delay, maxDelayMs), options.signal)
          continue
        }
        // Last attempt — return the 429/503 so the caller can decide.
        return res
      }

      // Retry transient 5xx (502/504 — gateway/timeout). 500/501 we surface
      // immediately because they're usually app-level bugs, not throttling.
      if (res.status === 502 || res.status === 504) {
        if (attempt < attempts - 1) {
          const delay = exponentialBackoff(attempt, baseDelayMs, maxDelayMs)
          options.onRetry?.({
            url,
            attempt: attempt + 1,
            attempts,
            delayMs: delay,
            reason: `HTTP ${res.status}`,
          })
          await res.body?.cancel().catch(() => {})
          await sleep(delay, options.signal)
          continue
        }
      }

      return res
    } catch (err: unknown) {
      lastError = err
      const reason = err instanceof Error ? err.message : String(err)
      // Don't retry if the *caller* aborted — only retry our own timeouts and
      // network failures.
      if (options.signal?.aborted) throw err

      if (attempt < attempts - 1) {
        const delay = exponentialBackoff(attempt, baseDelayMs, maxDelayMs)
        options.onRetry?.({
          url,
          attempt: attempt + 1,
          attempts,
          delayMs: delay,
          reason,
        })
        await sleep(delay, options.signal)
      }
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', externalAbort)
    }
  }

  throw lastError ?? new Error(`fetchWithBackoff exhausted ${attempts} attempts for ${url}`)
}

// Convenience wrapper for the common case of "GET and parse JSON".
export async function fetchJsonWithBackoff<T>(
  url: string,
  options: FetchWithBackoffOptions = {},
): Promise<T> {
  const res = await fetchWithBackoff(url, options)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`)
  }
  return (await res.json()) as T
}

// Exported for tests.
export const __internals = { parseRetryAfter, exponentialBackoff }
