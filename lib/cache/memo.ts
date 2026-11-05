// Small in-process cache for expensive, slightly-stale-is-fine reads (facet counts, averages, top lists).
//
// Hub pages are rendered per request (a deploy-time build cannot reach the database, so they cannot be prerendered),
// which made every visit run the same handful of aggregate queries. This keeps their results for a few minutes,
// which is the freshness the old build-time cache (`revalidate` of 5–10 minutes) gave. Concurrent callers share one
// load, and a failed load is never cached.

type Entry = { at: number; value: unknown }

const store = new Map<string, Entry>()
const inFlight = new Map<string, Promise<unknown>>()
const MAX_ENTRIES = 500

export const DEFAULT_TTL_MS = 5 * 60 * 1000

/** A cache key from any JSON-like value, including BigInt and Date, which JSON.stringify cannot handle itself. */
export function stableKey(...parts: unknown[]): string {
  return JSON.stringify(parts, (_k, v) => {
    if (typeof v === 'bigint') return `${v}n`
    if (v instanceof Date) return v.toISOString()
    return v
  })
}

export async function memoAsync<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const hit = store.get(key)
  if (hit && now() - hit.at < ttlMs) return hit.value as T

  const pending = inFlight.get(key)
  if (pending) return pending as Promise<T>

  const load = loader()
    .then((value) => {
      store.set(key, { at: now(), value })
      if (store.size > MAX_ENTRIES) {
        const oldest = store.keys().next().value
        if (oldest !== undefined) store.delete(oldest)
      }
      return value
    })
    .finally(() => inFlight.delete(key))
  inFlight.set(key, load)
  return load
}

export function __clearMemoForTests() {
  store.clear()
  inFlight.clear()
}
