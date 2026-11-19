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
}

export type DeckFilters = { keyword?: string; remote?: boolean }

export const DECK_PAGE = 20
/** Skipped ids the client sends back so they are not dealt again (it keeps the newest). */
export const MAX_SKIP_IDS = 500

type Row = Prisma.JobGetPayload<{ select: typeof jobListingSelect }>

/** One job as a card. Pure. */
export function toSwipeCard(job: Row): SwipeCard {
  const company = job.companyRef?.name || job.company
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

export async function swipeDeck(userId: string, filters: DeckFilters, skip: string[] = [], limit = DECK_PAGE): Promise<SwipeCard[]> {
  const keywordPlan = filters.keyword
    ? buildKeywordPlan(filters.keyword, await getSearchVocabulary().catch(() => null))
    : undefined
  const taken = await prisma.autoApplication.findMany({ where: { userId }, select: { jobId: true } })
  const exclude = [...new Set([...taken.map((t) => t.jobId), ...skip])]
  const rows = await prisma.job.findMany({
    where: {
      AND: [
        buildWhere({
          keyword: filters.keyword,
          keywordPlan,
          remoteMode: filters.remote ? 'remote' : undefined,
          excludeInternships: true,
        }),
        { applyUrl: { contains: 'greenhouse.io' } },
        ...(exclude.length ? [{ id: { notIn: exclude } }] : []),
      ],
    },
    select: jobListingSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    // Some greenhouse.io links are not job forms (a board's home page); ask for a few more than needed.
    take: limit + 10,
  })
  return rows.filter((r) => parseGreenhouseUrl(r.applyUrl)).slice(0, limit).map(toSwipeCard)
}
