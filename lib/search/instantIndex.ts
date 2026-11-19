// lib/search/instantIndex.ts
//
// The search-as-you-type index. Every live listing's searchable fields are held in server memory, so the search boxes'
// suggestions (/api/jobs/suggest) come back in milliseconds instead of seconds: a new query took 4-6 s on 2026-11-19,
// because each one ran the keyword search and a title group-by against the database. Matching, ranking and title grouping
// are the same rules the listing uses (lib/search/keywordPlan.ts, rankByRelevance in lib/jobs/queryJobs.ts), so the
// total is what /jobs?q= shows, give or take jobs added since the index was last loaded. The index is loaded from the
// listing's own filter (buildWhere) and refreshed in the background every few minutes; visitors keep getting the
// previous copy while a refresh runs.

import { buildLogoUrl } from '../companies/logo'
import { buildJobSlugHref } from '../jobs/jobSlug'
import { buildWhere, rankByRelevance, RELEVANCE_CANDIDATE_CAP } from '../jobs/queryJobs'
import { buildSalaryText } from '../jobs/salary'
import { prisma } from '../prisma'
import { scoreJob, WORD_BOUNDARIES, type KeywordPlan } from './keywordPlan'

const REFRESH_MS = 5 * 60 * 1000

export type IndexedJob = {
  id: string
  title: string
  company: string
  locationRaw: string
  techStack: string
  skillsJson: string
  posted: number
  remoteMode: string | null
  minAnnual: number | null
  maxAnnual: number | null
  currency: string | null
  pay: string | null
  href: string
  logo: string | null
  /** title, company, locationRaw, techStack, skillsJson in lower case: matched on every keystroke without re-lowering. */
  lc: string[]
}

/** Adds the lower-case search fields to a job. */
export function withSearchFields(job: Omit<IndexedJob, 'lc'>): IndexedJob {
  return { ...job, lc: [job.title, job.company, job.locationRaw, job.techStack, job.skillsJson].map((f) => (f ?? '').toLowerCase()) }
}

const BOUNDARY = new Set<string>(WORD_BOUNDARIES)

/** startsAWord on an already lower-case text, in one pass: the term at the start or right after a boundary character. */
function startsAWordLc(text: string, term: string): boolean {
  for (let i = text.indexOf(term); i !== -1; i = text.indexOf(term, i + 1)) {
    if (i === 0 || BOUNDARY.has(text[i - 1])) return true
  }
  return false
}

export type InstantFilters = { minAnnual?: number; remoteMode?: 'remote' | 'hybrid' | 'onsite' }

/** Does the job match every term of the plan, as buildWhere's keyword clauses do (a word of a field starts with it)? */
export function matchesPlan(plan: KeywordPlan, job: IndexedJob): boolean {
  return plan.terms.every((term) =>
    term.variants.some((variant) => {
      const v = variant.toLowerCase()
      return job.lc.some((f) => startsAWordLc(f, v))
    }),
  )
}

/** The salary and work-arrangement choices, as buildWhere applies them (a minimum compares in US dollars). */
export function passesFilters(job: IndexedJob, filters: InstantFilters): boolean {
  if (filters.remoteMode && job.remoteMode !== filters.remoteMode) return false
  if (filters.minAnnual) {
    if (job.currency !== 'USD') return false
    if (!((job.minAnnual ?? 0) >= filters.minAnnual || (job.maxAnnual ?? 0) >= filters.minAnnual)) return false
  }
  return true
}

/**
 * Pure: the suggestions for one query. `total` counts every match, `jobs` are the best by relevance (title matches first,
 * then newer), and `titles` are the most common titles among the filtered jobs that contain every typed word.
 */
export function searchInstantIndex(
  jobs: IndexedJob[],
  plan: KeywordPlan,
  query: string,
  filters: InstantFilters,
  opts: { now: number; shown: number; maxTitles: number; maxTitleWords: number },
) {
  const filtered = jobs.filter((j) => passesFilters(j, filters))
  const matches = plan.terms.length ? filtered.filter((j) => matchesPlan(plan, j)) : []
  // Like the listing's relevance order, only the newest RELEVANCE_CANDIDATE_CAP matches are scored: it keeps a broad
  // query ("engineer") from scoring thousands of jobs on every keystroke.
  const candidates = matches.length > RELEVANCE_CANDIDATE_CAP ? [...matches].sort((a, b) => b.posted - a.posted).slice(0, RELEVANCE_CANDIDATE_CAP) : matches
  const ranked = rankByRelevance(
    candidates.map((j) => ({ id: j.id, score: scoreJob(plan, j), posted: j.posted })),
    opts.now,
    false,
  )
  const byId = new Map(matches.map((j) => [j.id, j]))

  const words = query
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length >= 2)
    .slice(0, opts.maxTitleWords)
  const merged = new Map<string, { label: string; count: number; best: Map<string, number> }>()
  if (words.length) {
    for (const j of filtered) {
      const lower = j.title.toLowerCase()
      if (!words.every((w) => lower.includes(w))) continue
      const label = j.title.replace(/\s+/g, ' ').trim()
      const key = label.toLowerCase()
      const entry = merged.get(key) ?? { label, count: 0, best: new Map<string, number>() }
      entry.count++
      entry.best.set(label, (entry.best.get(label) ?? 0) + 1)
      merged.set(key, entry)
    }
  }
  const titles = [...merged.values()]
    .map((e) => ({ label: [...e.best.entries()].sort((a, b) => b[1] - a[1])[0][0], count: e.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, opts.maxTitles)

  return {
    total: matches.length,
    jobs: ranked.slice(0, opts.shown).map((id) => byId.get(id)!),
    titles,
  }
}

let current: { at: number; jobs: IndexedJob[] } | null = null
let loading: Promise<IndexedJob[]> | null = null

async function load(): Promise<IndexedJob[]> {
  const rows = await prisma.job.findMany({
    where: buildWhere({ page: 1, pageSize: 1 }),
    select: {
      id: true,
      title: true,
      company: true,
      locationRaw: true,
      techStack: true,
      skillsJson: true,
      postedAt: true,
      createdAt: true,
      remote: true,
      remoteMode: true,
      countryCode: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      salaryRaw: true,
      companyRef: { select: { logoUrl: true, website: true } },
    },
  })
  return rows.map((r) => withSearchFields({
    id: r.id,
    title: r.title,
    company: r.company,
    locationRaw: r.locationRaw ?? '',
    techStack: r.techStack ?? '',
    skillsJson: r.skillsJson ?? '',
    posted: (r.postedAt ?? r.createdAt).getTime(),
    remoteMode: r.remoteMode,
    minAnnual: r.minAnnual == null ? null : Number(r.minAnnual),
    maxAnnual: r.maxAnnual == null ? null : Number(r.maxAnnual),
    currency: r.currency,
    pay: buildSalaryText(r),
    href: buildJobSlugHref(r),
    logo: buildLogoUrl(r.companyRef?.logoUrl ?? null, r.companyRef?.website ?? null, r.company),
  }))
}

function refresh(): Promise<IndexedJob[]> {
  loading ??= load()
    .then((jobs) => {
      current = { at: Date.now(), jobs }
      return jobs
    })
    .finally(() => {
      loading = null
    })
  return loading
}

/** The live listings, from memory. The first call waits for the load; later calls refresh a stale copy in the background. */
export async function getInstantIndex(): Promise<IndexedJob[]> {
  if (!current) return refresh()
  if (Date.now() - current.at > REFRESH_MS) refresh().catch((e) => console.error('[instant-index] refresh failed:', e instanceof Error ? e.message : e))
  return current.jobs
}
