// lib/jobs/formatAgo.ts
//
// Kept apart from lib/jobs/latestFeed.ts (which loads the database) so a client component can import it.

/** "just now", "40 sec ago", "5 min ago", "3 hr ago", "2 days ago". Pure, so the client can tick it and the tests can pin the clock. */
export function formatAgo(iso: string, nowMs: number): string {
  const ms = nowMs - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 10_000) return 'just now'
  if (ms < 60_000) return `${Math.floor(ms / 10_000) * 10} sec ago`
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  return `${day} ${day === 1 ? 'day' : 'days'} ago`
}
