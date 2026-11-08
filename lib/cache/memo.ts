// Small in-process cache for expensive, slightly-stale-is-fine reads (facet counts, averages, top lists).
//
// Hub pages are rendered per request (a deploy-time build cannot reach the database, so they cannot be prerendered),
// which made every visit run the same handful of aggregate queries. This keeps their results for a few minutes,
// which is the freshness the old build-time cache (`revalidate` of 5–10 minutes) gave. Concurrent callers share one
// load, and a failed load is never cached.
//
// Stale-while-revalidate: once an entry is past its TTL (but less than MAX_STALE_MS past it), the old value is returned
// at once and one refresh runs in the background. Before this, the first visitor after each expiry waited for every
// query again (role pages: 1.7-3.3s instead of ~0.3s, measured 2026-11-08).

type Entry = { at: number; value: unknown }

const store = new Map<string, Entry>()
const inFlight = new Map<string, Promise<unknown>>()
const MAX_ENTRIES = 500

export const DEFAULT_TTL_MS = 5 * 60 * 1000
/** How long past its TTL an entry may still be served while it refreshes; older than this, callers wait. */
export const MAX_STALE_MS = 60 * 60 * 1000

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
  const age = hit ? now() - hit.at : Infinity
  if (hit && age < ttlMs) return hit.value as T

  if (hit && age < ttlMs + MAX_STALE_MS) {
    // Serve the stale value; refresh once in the background. A failed refresh keeps the old value for the next try.
    if (!inFlight.has(key)) startLoad(key, loader, now).catch(() => undefined)
    return hit.value as T
  }

  const pending = inFlight.get(key)
  if (pending) return pending as Promise<T>
  return startLoad(key, loader, now)
}

function startLoad<T>(key: string, loader: () => Promise<T>, now: () => number): Promise<T> {
  const load = loader()
    .then((value) => {
      store.delete(key) // re-insert so the eviction order below follows the last write
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
