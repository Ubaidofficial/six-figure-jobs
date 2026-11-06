// lib/jobs/bandLinks.ts
//
// The "popular role x salary band" chips on /jobs come from the precomputed JobSlice table. The page behind each chip
// (/jobs/<role>/<band>-plus) runs its own live query and permanently redirects to the role page when it finds no jobs, so
// a stale slice made a chip that promised "$400k+ Data Scientist jobs" open a different page. A chip is now kept only when
// the page behind it would really show jobs (the same query the page runs).

import { memoAsync } from '@/lib/cache/memo'
import { queryJobs } from '@/lib/jobs/queryJobs'

const BAND_PATH = /^\/jobs\/([a-z0-9-]+)\/(\d+)k-plus\/?$/
const TTL_MS = 30 * 60 * 1000

/** `/jobs/data-scientist/400k-plus` to { role, min: 400000 }; null for any other path. */
export function parseRoleBandPath(href: string): { role: string; min: number } | null {
  const m = BAND_PATH.exec(href)
  return m ? { role: m[1], min: Number(m[2]) * 1000 } : null
}

export function roleBandHasJobs(role: string, min: number): Promise<boolean> {
  return memoAsync(`role-band:${role}:${min}`, TTL_MS, async () => {
    const { total } = await queryJobs({ roleSlugs: [role], minAnnual: min, pageSize: 1 })
    return total > 0
  })
}

/** Drops role-band links whose page would redirect. Other links pass through; a failed check keeps the link. */
export async function dropEmptyRoleBandLinks<T extends { href: string }>(
  links: T[],
  hasJobs: (role: string, min: number) => Promise<boolean> = roleBandHasJobs,
): Promise<T[]> {
  const kept = await Promise.all(
    links.map(async (link) => {
      const band = parseRoleBandPath(link.href)
      if (!band) return true
      try {
        return await hasJobs(band.role, band.min)
      } catch {
        return true
      }
    }),
  )
  return links.filter((_, i) => kept[i])
}
