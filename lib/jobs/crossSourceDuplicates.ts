// lib/jobs/crossSourceDuplicates.ts
//
// The same opening imported twice: freehire lists a job from the employer's applicant tracking system and again from
// a job board that re-posted it, with location text that differs ("London" and "London, UK"), so the ingest dedupe key
// (company + title + full location) does not match. Seen live on 2026-11-08: iwoca's "Applied AI Engineer" from Ashby
// and from Adzuna. Within one company, live jobs with the same title in the same city are one opening; the copy whose
// apply link goes to the employer (not a board) is kept, then the newest.
import { normalizeTitle } from '../ingest/dedupeHelpers'
import { boardNameFor } from '../scrapers/utils/boardHosts'

export type DuplicateCandidate = {
  id: string
  companyId: string | null
  title: string
  locationRaw: string | null
  city: string | null
  applyUrl: string | null
  url: string | null
  postedAt: Date | null
  createdAt: Date
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Where the job is: its city ("London" for "London, UK"); remote or unplaceable jobs keep their whole location text. */
function placeKey(job: DuplicateCandidate): string | null {
  const raw = String(job.locationRaw ?? '').trim()
  const first = fold(String(job.city ?? '').trim() || raw.split(/[,;|]/)[0] || '')
  if (!first) return null
  // "Remote, United States" and "Remote, Canada" are different jobs: compare the whole text.
  if (/^(remote|anywhere|worldwide|global|hybrid)\b/.test(first)) return fold(raw)
  return first
}

/** The ids to expire: every copy but the best one in each group of the same opening. */
export function duplicateJobIdsToExpire(jobs: DuplicateCandidate[]): string[] {
  const groups = new Map<string, DuplicateCandidate[]>()
  for (const job of jobs) {
    const place = placeKey(job)
    const title = normalizeTitle(job.title)
    if (!job.companyId || !place || !title) continue
    const key = `${job.companyId}::${title}::${place}`
    groups.set(key, [...(groups.get(key) ?? []), job])
  }
  const expire: string[] = []
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const ranked = [...group].sort((a, b) => {
      const boardA = boardNameFor(a.applyUrl || a.url) ? 1 : 0
      const boardB = boardNameFor(b.applyUrl || b.url) ? 1 : 0
      if (boardA !== boardB) return boardA - boardB
      const timeA = (a.postedAt ?? a.createdAt).getTime()
      const timeB = (b.postedAt ?? b.createdAt).getTime()
      return timeB - timeA || a.id.localeCompare(b.id)
    })
    expire.push(...ranked.slice(1).map((j) => j.id))
  }
  return expire
}
