import type { ListingStat } from '@/components/listing/ListingParts'

export type WorkTypeCounts = { remote: number; hybrid: number; onsite: number }
export type WorkTypeMode = 'remote' | 'hybrid' | 'onsite'

/**
 * Header links "11 remote roles · 3 hybrid roles · 1 on-site roles". Each count is the current search with that work
 * type applied, so it matches what the link returns. Filter links are not crawled (`nofollow`). Pass `selected` when a
 * work type is already chosen: the links then make no sense, so none are returned.
 */
export function workTypeStats(
  counts: WorkTypeCounts,
  hrefFor: (mode: WorkTypeMode) => string,
  selected?: string | null,
): ListingStat[] {
  if (selected) return []
  const rows: Array<[WorkTypeMode, string]> = [
    ['remote', 'remote roles'],
    ['hybrid', 'hybrid roles'],
    ['onsite', 'on-site roles'],
  ]
  return rows.map(([mode, label]) => ({ label, count: counts[mode], href: hrefFor(mode), nofollow: true }))
}
