// lib/companies/directEmployerSchedule.ts
// The order the daily sync reads direct employers in: the one synced longest ago first, never-synced ones before all.
//
// The sync step has a time limit, and with 20 large Workday boards it stopped part-way on 2026-11-11 (90 minutes).
// It now stops starting employers before the limit; reading the least recently synced first means whoever was not
// reached today goes first tomorrow, so every employer is refreshed well within the 7-day expiry window.
import type { DirectEmployer } from '../constants/directEmployers'

/** `lastSynced` holds each employer's last successful sync by slug; missing or null means never. Stable for ties. */
export function orderBySyncAge<T extends Pick<DirectEmployer, 'slug'>>(
  employers: readonly T[],
  lastSynced: ReadonlyMap<string, Date | null>,
): T[] {
  const at = (e: T) => lastSynced.get(e.slug)?.getTime() ?? -Infinity
  return employers
    .map((e, i) => ({ e, i }))
    .sort((a, b) => at(a.e) - at(b.e) || a.i - b.i)
    .map(({ e }) => e)
}
