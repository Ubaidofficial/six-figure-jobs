// lib/autoapply/deck.ts
// The swipe deck: $100k+ jobs a signed-in user can auto-apply to (the employer's form is on Greenhouse, the only one we
// support), newest first, without jobs the user already has an application for or skipped. A right swipe makes a draft
// through the same prepareApplication as the kit page's button; nothing is sent until the user approves that draft.

import type { Prisma } from '@prisma/client'

import { buildLogoUrl } from '@/lib/companies/logo'
import { cleanAlertKeyword } from '@/lib/alerts/keyword'
import { buildJobSlug } from '@/lib/jobs/jobSlug'
import { buildWhere, jobListingSelect } from '@/lib/jobs/queryJobs'
import { buildSalaryText } from '@/lib/jobs/salary'
import { describeJobLocation } from '@/lib/location/jobLocation'
import { prisma } from '@/lib/prisma'
import { buildKeywordPlan } from '@/lib/search/keywordPlan'
import { getSearchVocabulary } from '@/lib/search/vocabulary'

import { parseGreenhouseUrl } from './greenhouse'
import { matchJob, seniorityLabel, skillLabel, type MatchResult } from './match'

export type SwipeCard = {
  id: string
  /** The job page's slug, which prepareApplication takes. */
  slug: string
  title: string
  company: string
  logo: string | null
  salary: string | null
  location: string | null
  remote: boolean
  /** ISO time we first listed it. */
  listedAt: string
  /** One or two sentences about the role (the AI summary), or null. */
  summary: string | null
  /** Up to 6 of the job's skills; `have` when the user's résumé names it. */
  skills: Array<{ name: string; have: boolean }>
  /** "Senior", "Staff"...; null when unknown. */
  seniority: string | null
  /** How the job matches the user's résumé (lib/autoapply/match.ts); null without a résumé. */
  match: Pick<MatchResult, 'score' | 'label' | 'reasons'> | null
}

export type DeckFilters = { keyword?: string; remote?: boolean }

export const DECK_PAGE = 20
/** Skipped ids the client sends back so they are not dealt again (it keeps the newest). */
export const MAX_SKIP_IDS = 500

type Row = Prisma.JobGetPayload<{ select: typeof jobListingSelect }>

const MAX_SKILLS = 6

/** A JSON array of skill names (techStack) or slugs (skillsJson), as strings. */
function jsonList(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []
  } catch {
    return []
  }
}

/** One job as a card, matched against the user's résumé when there is one. Pure. */
export function toSwipeCard(job: Row, resumeText?: string | null): SwipeCard {
  const company = job.companyRef?.name || job.company
  const j = job as Row & { techStack?: string | null; skillsJson?: string | null; aiOneLiner?: string | null; aiSnippet?: string | null; experienceLevel?: string | null }
  // Display names first (techStack), then slugs not already named; one entry per skill.
  const seen = new Set<string>()
  const skills = [...jsonList(j.techStack), ...jsonList(j.skillsJson)].map(skillLabel).filter((name) => {
    const k = name.toLowerCase().replace(/[^a-z0-9+#]+/g, '')
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
  const match = resumeText?.trim() ? matchJob(resumeText, { title: job.title, experienceLevel: j.experienceLevel, skills }) : null
  const have = new Set(match?.matched ?? [])
  const summary = (j.aiOneLiner || j.aiSnippet || '').replace(/\s+/g, ' ').trim() || null
  return {
    id: job.id,
    slug: buildJobSlug(job as never),
    title: job.title,
    company,
    logo: buildLogoUrl(job.companyRef?.logoUrl ?? job.companyLogo ?? null, job.companyRef?.website ?? null, company),
    salary: buildSalaryText(job as never),
    location: describeJobLocation(job as never).text || null,
    remote: (job as { remoteMode?: string | null }).remoteMode === 'remote' || (job as { remote?: boolean | null }).remote === true,
    listedAt: (job.createdAt ?? new Date()).toISOString(),
    summary,
    skills: skills.slice(0, MAX_SKILLS).map((name) => ({ name, have: have.has(name) })),
    seniority: seniorityLabel(j.experienceLevel, job.title),
    match: match ? { score: match.score, label: match.label, reasons: match.reasons } : null,
  }
}

/** The client's filters and skipped ids, checked. */
export function readDeckRequest(raw: unknown): { filters: DeckFilters; skip: string[] } {
  const b = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const keyword = typeof b.keyword === 'string' && b.keyword.trim() ? cleanAlertKeyword(b.keyword) ?? undefined : undefined
  const skip = Array.isArray(b.skip)
    ? b.skip.filter((s): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s)).slice(-MAX_SKIP_IDS)
    : []
  return { filters: { keyword, remote: b.remote === true }, skip }
}

/** Live $100k+ jobs whose form we can fill (Greenhouse), for these filters. */
async function deckWhere(filters: DeckFilters): Promise<Prisma.JobWhereInput> {
  const keywordPlan = filters.keyword
    ? buildKeywordPlan(filters.keyword, await getSearchVocabulary().catch(() => null))
    : undefined
  return {
    AND: [
      buildWhere({ keyword: filters.keyword, keywordPlan, remoteMode: filters.remote ? 'remote' : undefined, excludeInternships: true }),
      { applyUrl: { contains: 'greenhouse.io' } },
    ],
  }
}

/** How many jobs the deck could deal were added in the last 24 hours (the top bar's "N new today"). */
export async function newDeckJobsToday(now = new Date()): Promise<number> {
  return prisma.job.count({ where: { AND: [await deckWhere({}), { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }] } })
}

export async function swipeDeck(userId: string, filters: DeckFilters, skip: string[] = [], limit = DECK_PAGE): Promise<SwipeCard[]> {
  const [taken, resume, where] = await Promise.all([
    prisma.autoApplication.findMany({ where: { userId }, select: { jobId: true } }),
    prisma.resume.findUnique({ where: { userId }, select: { text: true } }),
    deckWhere(filters),
  ])
  const exclude = [...new Set([...taken.map((t) => t.jobId), ...skip])]
  const rows = await prisma.job.findMany({
    where: { AND: [where, ...(exclude.length ? [{ id: { notIn: exclude } }] : [])] },
    select: jobListingSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    // Some greenhouse.io links are not job forms (a board's home page); ask for a few more than needed.
    take: limit + 10,
  })
  return rows.filter((r) => parseGreenhouseUrl(r.applyUrl)).slice(0, limit).map((r) => toSwipeCard(r, resume?.text))
}
