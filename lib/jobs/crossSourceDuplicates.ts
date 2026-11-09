// lib/jobs/crossSourceDuplicates.ts
//
// The same opening imported twice: freehire lists a job from the employer's applicant tracking system and again from
// a job board that re-posted it, with location text that differs ("London" and "London, UK"), so the ingest dedupe key
// (company + title + full location) does not match. Seen live on 2026-11-08: iwoca's "Applied AI Engineer" from Ashby
// and from Adzuna. Within one company, live jobs with the same title in the same city are one opening; the copy whose
// apply link goes to the employer (not a board) is kept, then the newest.
//
// The same holds within one employer account on an applicant tracking system, whatever company record each copy got:
// GDIT's "Senior System Administrator - DISA E-ICAM Program" was live twice on 2026-11-09, once under "gdit" and once
// under "General Dynamics Information Technology", from two career sites of the one Workday tenant
// (gdit.wd5.myworkdayjobs.com/GDIT_Empl_Ref/... and .../External_Career_Site/...).
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

// Platforms that give each employer its own subdomain, and ones that put the employer in the first path segment.
const SUBDOMAIN_ATS = /^([a-z0-9-]+)\.(?:wd\d+\.myworkdayjobs\.com|recruitee\.com|teamtailor\.com|bamboohr\.com|breezy\.hr)$/
const PATH_ATS = /^(?:boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|apply\.workable\.com)$/

const INTERNAL_SITE = /[/_-](?:empl_ref|employee_?referrals?|referrals?|internal)(?:[/_-]|$)/i

/** The employer's account on an applicant tracking system ("myworkdayjobs:gdit"), from the job's apply link, or null. */
export function atsTenantKey(link: string | null): string | null {
  if (!link) return null
  let u: URL
  try {
    u = new URL(link)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const sub = host.match(SUBDOMAIN_ATS)
  if (sub) return `${host.slice(sub[1].length + 1).replace(/^wd\d+\./, '')}:${sub[1]}`
  if (PATH_ATS.test(host)) {
    const first = u.pathname.split('/').filter(Boolean)[0]?.toLowerCase()
    return first ? `${host.replace(/^job-boards\./, 'boards.')}:${first}` : null
  }
  return null
}

/** The ids to expire: every copy but the best one in each group of the same opening. */
export function duplicateJobIdsToExpire(jobs: DuplicateCandidate[]): string[] {
  // Copies are one opening when they share a company or an applicant-tracking account, plus the title and place;
  // the two can chain (A and B share a company, B and C an account), so groups are joined with union-find.
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)!
    parent.set(id, root)
    return root
  }
  const firstWithKey = new Map<string, string>()
  const byId = new Map<string, DuplicateCandidate>()
  for (const job of jobs) {
    const place = placeKey(job)
    const title = normalizeTitle(job.title)
    if (!place || !title) continue
    const tenant = atsTenantKey(job.applyUrl || job.url)
    const keys = [
      job.companyId ? `company:${job.companyId}::${title}::${place}` : null,
      tenant ? `ats:${tenant}::${title}::${place}` : null,
    ].filter((k): k is string => k !== null)
    if (!keys.length) continue
    byId.set(job.id, job)
    parent.set(job.id, job.id)
    for (const key of keys) {
      const other = firstWithKey.get(key)
      if (other) parent.set(find(job.id), find(other))
      else firstWithKey.set(key, job.id)
    }
  }
  const groups = new Map<string, DuplicateCandidate[]>()
  for (const [id, job] of byId) {
    const root = find(id)
    groups.set(root, [...(groups.get(root) ?? []), job])
  }
  const expire: string[] = []
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const ranked = [...group].sort((a, b) => {
      const boardA = boardNameFor(a.applyUrl || a.url) ? 1 : 0
      const boardB = boardNameFor(b.applyUrl || b.url) ? 1 : 0
      if (boardA !== boardB) return boardA - boardB
      // An employee-referral or internal career site (Workday "GDIT_Empl_Ref") is not where outside applicants apply.
      const inA = INTERNAL_SITE.test(a.applyUrl || a.url || '') ? 1 : 0
      const inB = INTERNAL_SITE.test(b.applyUrl || b.url || '') ? 1 : 0
      if (inA !== inB) return inA - inB
      const timeA = (a.postedAt ?? a.createdAt).getTime()
      const timeB = (b.postedAt ?? b.createdAt).getTime()
      return timeB - timeA || a.id.localeCompare(b.id)
    })
    expire.push(...ranked.slice(1).map((j) => j.id))
  }
  return expire
}
