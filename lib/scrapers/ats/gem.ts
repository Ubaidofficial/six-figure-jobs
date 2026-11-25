// lib/scrapers/ats/gem.ts
//
// Gem job boards (jobs.gem.com/<board>), read from Gem's public job board API (owner's request, 2026-11-25: "do all
// three", item 3; remote100k listed 9 jobs at BigPanda and Linktree on Gem):
//   GET https://api.gem.com/job_board/v0/<board>/job_posts/
// Each post has the title, location, location type (remote / hybrid / in office), dates and the description. Gem gives no
// pay field: pay is read from the posting's own sentences, only through lib/jobs/payEvidence.ts (CLAUDE.md), and the
// usual salary gate applies at ingest.
import { readPayFromDescription } from '../../jobs/payEvidence'
import type { ATSResult, AtsJob } from './types'

const HEADERS = { Accept: 'application/json', 'User-Agent': 'SixFigureJobs/1.0 (+job-board-scraper)' }

/** The board name in a jobs.gem.com URL (pure); null when it is not one. */
export function parseGemBoard(url: string): string | null {
  try {
    const u = new URL(url)
    if (!/^(?:jobs\.gem\.com|api\.gem\.com)$/i.test(u.hostname)) return null
    const parts = u.pathname.split('/').filter(Boolean)
    const board = u.hostname.startsWith('api.') ? parts[2] : parts[0]
    return board && /^[A-Za-z0-9_.-]+$/.test(board) ? board : null
  } catch {
    return null
  }
}

export type GemPost = {
  id: string
  title?: string
  absolute_url?: string
  content?: string | null
  content_plain?: string | null
  location?: { name?: string | null } | null
  location_type?: string | null
  employment_type?: string | null
  first_published_at?: string | null
  updated_at?: string | null
  offices?: Array<{ location?: { name?: string | null } | null }>
}

/** Gem's location type as ours (pure). */
export function workplaceFromGem(type: string | null | undefined): AtsJob['workplaceType'] {
  const t = String(type ?? '').toLowerCase()
  if (t === 'remote') return 'remote'
  if (t === 'hybrid') return 'hybrid'
  if (t === 'in_office' || t === 'onsite' || t === 'on_site' || t === 'office') return 'onsite'
  return null
}

/** One post as the ATS ingest takes it (pure). */
export function mapGemPost(board: string, p: GemPost): AtsJob {
  const workplaceType = workplaceFromGem(p.location_type)
  const location = p.location?.name?.trim() || p.offices?.map((o) => o.location?.name).filter(Boolean)[0] || null
  const pay = readPayFromDescription(p.content ?? p.content_plain ?? null, { location })
  return {
    externalId: String(p.id),
    title: String(p.title ?? '').trim(),
    url: p.absolute_url || `https://jobs.gem.com/${board}/${p.id}`,
    locationText: location,
    remote: workplaceType === 'remote',
    workplaceType,
    salaryMin: pay?.min ?? null,
    salaryMax: pay?.max ?? null,
    salaryCurrency: pay?.currency ?? null,
    salaryInterval: pay ? 'year' : null,
    salaryRaw: pay?.quote ?? null,
    employmentType: p.employment_type ? p.employment_type.replace(/_/g, '-') : null,
    descriptionHtml: p.content ?? null,
    postedAt: p.first_published_at ? new Date(p.first_published_at) : null,
    updatedAt: p.updated_at ? new Date(p.updated_at) : null,
  }
}

export async function scrapeGemResult(atsUrl: string, fetchFn: typeof fetch = fetch): Promise<ATSResult> {
  const board = parseGemBoard(atsUrl)
  if (!board) return { success: false, source: 'gem', atsUrl, error: 'Not a jobs.gem.com board URL' }
  try {
    const res = await fetchFn(`https://api.gem.com/job_board/v0/${encodeURIComponent(board)}/job_posts/`, { headers: HEADERS, signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return { success: false, source: 'gem', atsUrl, error: `HTTP ${res.status}` }
    const posts = (await res.json()) as GemPost[]
    if (!Array.isArray(posts)) return { success: false, source: 'gem', atsUrl, error: 'Unexpected answer' }
    return { success: true, source: 'gem', atsUrl, jobs: posts.filter((p) => p.id && p.title).map((p) => mapGemPost(board, p)) }
  } catch (error) {
    return { success: false, source: 'gem', atsUrl, error: error instanceof Error ? error.message : String(error) }
  }
}
