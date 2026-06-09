import { unstable_cache } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { buildWhere } from '@/lib/jobs/queryJobs'
import {
  QUALITY_MIN_AI_ONE_LINER_CHARS,
  QUALITY_MIN_AI_SNIPPET_CHARS,
} from '@/lib/jobs/qualityGate'
import { getPriorityCompanyRank } from '@/lib/seo/priorityCompanies'

export const COMPANY_PSEO_MIN_JOBS = Math.max(
  1,
  Number(process.env.COMPANY_PSEO_MIN_JOBS || '5'),
)
export const COMPANY_PSEO_MIN_SALARY_BACKED_JOBS = Math.max(
  0,
  Number(process.env.COMPANY_PSEO_MIN_SALARY_BACKED_JOBS || '2'),
)
export const COMPANY_PSEO_MIN_ROLE_DIVERSITY = Math.max(
  1,
  Number(process.env.COMPANY_PSEO_MIN_ROLE_DIVERSITY || '2'),
)
export const COMPANY_PSEO_MIN_RICH_JOB_COUNT = Math.max(
  1,
  Number(process.env.COMPANY_PSEO_MIN_RICH_JOB_COUNT || '3'),
)
export const COMPANY_PSEO_BATCH_SIZE = Math.max(
  1,
  Number(process.env.COMPANY_PSEO_BATCH_SIZE || '5'),
)
export const COMPANY_PSEO_BATCH_DAYS = Math.max(
  1,
  Number(process.env.COMPANY_PSEO_BATCH_DAYS || '3'),
)
export const COMPANY_PSEO_START_DATE =
  process.env.COMPANY_PSEO_START_DATE || '2026-06-04T00:00:00.000Z'

type CandidateCompany = {
  id: string
  slug: string
  name: string
  description: string | null
  website: string | null
  logoUrl: string | null
  industry: string | null
  sizeBucket: string | null
  headquarters: string | null
  atsUrl: string | null
  updatedAt: Date
}

type CandidateJob = {
  companyId: string
  roleSlug: string | null
  citySlug: string | null
  countryCode: string | null
  remote: boolean | null
  remoteMode: string | null
  salarySource: string | null
  aiSnippet: string | null
  aiOneLiner: string | null
  descriptionHtml: string | null
  updatedAt: Date
}

type CandidateAggregate = {
  liveJobs: number
  salaryBackedJobs: number
  enrichedJobs: number
  richJobContentJobs: number
  roleKeys: Set<string>
  locationKeys: Set<string>
  freshestJobUpdatedAt: Date | null
}

export type CompanyPublishingCandidate = {
  companyId: string
  slug: string
  name: string
  priorityRank: number | null
  liveJobs: number
  salaryBackedJobs: number
  enrichedJobs: number
  richJobContentJobs: number
  roleDiversity: number
  locationDiversity: number
  metadataSignals: number
  score: number
  ready: boolean
  reasons: string[]
  rolloutRank: number | null
  unlocked: boolean
  latestUpdatedAt: string
}

export type CompanyPublishingManifest = {
  batchDays: number
  batchSize: number
  readyCount: number
  unlockedCount: number
  nextUnlockAt: string | null
  candidates: CompanyPublishingCandidate[]
}

function stripHtml(input: string | null | undefined): string {
  return String(input || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasAiSnippet(job: CandidateJob): boolean {
  return String(job.aiSnippet || '').trim().length >= QUALITY_MIN_AI_SNIPPET_CHARS
}

function hasAiOneLiner(job: CandidateJob): boolean {
  return String(job.aiOneLiner || '').trim().length >= QUALITY_MIN_AI_ONE_LINER_CHARS
}

function hasRichJobContent(job: CandidateJob): boolean {
  if (hasAiSnippet(job) || hasAiOneLiner(job)) return true
  return stripHtml(job.descriptionHtml).length >= 220
}

function buildLocationKey(job: CandidateJob): string | null {
  if (job.remote === true || job.remoteMode === 'remote') return 'remote'
  if (job.citySlug) return `city:${job.citySlug}`
  if (job.countryCode) return `country:${job.countryCode}`
  return null
}

function countMetadataSignals(company: CandidateCompany): number {
  let count = 0
  if (stripHtml(company.description).length >= 140) count++
  if (company.website) count++
  if (company.logoUrl) count++
  if (company.industry) count++
  if (company.sizeBucket) count++
  if (company.headquarters) count++
  if (company.atsUrl) count++
  return count
}

function scoreCandidate(
  company: CandidateCompany,
  aggregate: CandidateAggregate,
  metadataSignals: number,
): number {
  const liveJobs = Math.min(aggregate.liveJobs, 40)
  const salaryBacked = Math.min(aggregate.salaryBackedJobs, 15)
  const enriched = Math.min(aggregate.enrichedJobs, 10)
  const richContent = Math.min(aggregate.richJobContentJobs, 10)
  const roles = Math.min(aggregate.roleKeys.size, 8)
  const locations = Math.min(aggregate.locationKeys.size, 6)
  const priorityRank = getPriorityCompanyRank(company.slug)
  const priorityBonus = priorityRank ? Math.max(0, 24 - priorityRank) * 6 : 0

  return (
    liveJobs * 8 +
    salaryBacked * 7 +
    enriched * 4 +
    richContent * 3 +
    roles * 5 +
    locations * 3 +
    metadataSignals * 4 +
    priorityBonus
  )
}

function evaluateReadiness(
  company: CandidateCompany,
  aggregate: CandidateAggregate,
  metadataSignals: number,
): string[] {
  const reasons: string[] = []
  const descriptionLength = stripHtml(company.description).length

  if (aggregate.liveJobs < COMPANY_PSEO_MIN_JOBS) {
    reasons.push(`live_jobs_lt_${COMPANY_PSEO_MIN_JOBS}`)
  }
  if (aggregate.salaryBackedJobs < COMPANY_PSEO_MIN_SALARY_BACKED_JOBS) {
    reasons.push(`salary_backed_lt_${COMPANY_PSEO_MIN_SALARY_BACKED_JOBS}`)
  }
  if (aggregate.roleKeys.size < COMPANY_PSEO_MIN_ROLE_DIVERSITY) {
    reasons.push(`role_diversity_lt_${COMPANY_PSEO_MIN_ROLE_DIVERSITY}`)
  }
  if (!company.website) {
    reasons.push('missing_website')
  }
  if (
    descriptionLength < 140 &&
    aggregate.richJobContentJobs < COMPANY_PSEO_MIN_RICH_JOB_COUNT
  ) {
    reasons.push(`thin_content_lt_${COMPANY_PSEO_MIN_RICH_JOB_COUNT}`)
  }
  if (metadataSignals < 3) {
    reasons.push('weak_company_metadata')
  }

  return reasons
}

function readStartDate(now: Date): Date {
  const parsed = new Date(COMPANY_PSEO_START_DATE)
  return Number.isFinite(parsed.getTime()) ? parsed : now
}

function getUnlockedCount(readyCount: number, now: Date): number {
  const start = readStartDate(now)
  if (now.getTime() < start.getTime()) return 0

  const intervalMs = COMPANY_PSEO_BATCH_DAYS * 24 * 60 * 60 * 1000
  const windowsElapsed = Math.floor((now.getTime() - start.getTime()) / intervalMs) + 1
  return Math.min(readyCount, windowsElapsed * COMPANY_PSEO_BATCH_SIZE)
}

function getNextUnlockAt(readyCount: number, unlockedCount: number, now: Date): string | null {
  if (readyCount <= unlockedCount) return null

  const start = readStartDate(now)
  if (now.getTime() < start.getTime()) return start.toISOString()

  const intervalMs = COMPANY_PSEO_BATCH_DAYS * 24 * 60 * 60 * 1000
  const windowsElapsed = Math.floor((now.getTime() - start.getTime()) / intervalMs) + 1
  return new Date(start.getTime() + windowsElapsed * intervalMs).toISOString()
}

async function buildCompanyPublishingManifestData(now = new Date()): Promise<CompanyPublishingManifest> {
  const eligibleJobWhere = {
    ...buildWhere({}),
    companyId: { not: null },
  }

  const jobs = (await prisma.job.findMany({
    where: eligibleJobWhere,
    select: {
      companyId: true,
      roleSlug: true,
      citySlug: true,
      countryCode: true,
      remote: true,
      remoteMode: true,
      salarySource: true,
      aiSnippet: true,
      aiOneLiner: true,
      descriptionHtml: true,
      updatedAt: true,
    },
  })) as CandidateJob[]

  const companyIds = Array.from(new Set(jobs.map((job) => job.companyId).filter(Boolean)))
  if (companyIds.length === 0) {
    return {
      batchDays: COMPANY_PSEO_BATCH_DAYS,
      batchSize: COMPANY_PSEO_BATCH_SIZE,
      readyCount: 0,
      unlockedCount: 0,
      nextUnlockAt: null,
      candidates: [],
    }
  }

  const companies = (await prisma.company.findMany({
    where: { id: { in: companyIds } },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      website: true,
      logoUrl: true,
      industry: true,
      sizeBucket: true,
      headquarters: true,
      atsUrl: true,
      updatedAt: true,
    },
  })) as CandidateCompany[]

  const aggregates = new Map<string, CandidateAggregate>()
  for (const job of jobs) {
    const current = aggregates.get(job.companyId) ?? {
      liveJobs: 0,
      salaryBackedJobs: 0,
      enrichedJobs: 0,
      richJobContentJobs: 0,
      roleKeys: new Set<string>(),
      locationKeys: new Set<string>(),
      freshestJobUpdatedAt: null,
    }

    current.liveJobs += 1
    if (job.salarySource === 'ats') current.salaryBackedJobs += 1
    if (hasAiSnippet(job) || hasAiOneLiner(job)) current.enrichedJobs += 1
    if (hasRichJobContent(job)) current.richJobContentJobs += 1
    if (job.roleSlug) current.roleKeys.add(job.roleSlug)

    const locationKey = buildLocationKey(job)
    if (locationKey) current.locationKeys.add(locationKey)

    if (!current.freshestJobUpdatedAt || job.updatedAt > current.freshestJobUpdatedAt) {
      current.freshestJobUpdatedAt = job.updatedAt
    }

    aggregates.set(job.companyId, current)
  }

  const baseCandidateRows: Array<CompanyPublishingCandidate | null> = companies.map((company) => {
      const aggregate = aggregates.get(company.id)
      if (!aggregate) return null

      const metadataSignals = countMetadataSignals(company)
      const reasons = evaluateReadiness(company, aggregate, metadataSignals)
      const score = scoreCandidate(company, aggregate, metadataSignals)

      return {
        companyId: company.id,
        slug: company.slug,
        name: company.name,
        priorityRank: getPriorityCompanyRank(company.slug),
        liveJobs: aggregate.liveJobs,
        salaryBackedJobs: aggregate.salaryBackedJobs,
        enrichedJobs: aggregate.enrichedJobs,
        richJobContentJobs: aggregate.richJobContentJobs,
        roleDiversity: aggregate.roleKeys.size,
        locationDiversity: aggregate.locationKeys.size,
        metadataSignals,
        score,
        ready: reasons.length === 0,
        reasons,
        rolloutRank: null,
        unlocked: false,
        latestUpdatedAt: new Date(
          Math.max(
            aggregate.freshestJobUpdatedAt?.getTime() ?? 0,
            company.updatedAt.getTime(),
          ),
        ).toISOString(),
      } satisfies CompanyPublishingCandidate
    })

  const baseCandidates = baseCandidateRows
    .filter((candidate): candidate is CompanyPublishingCandidate => candidate !== null)
    .sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1
      if ((a.priorityRank ?? Infinity) !== (b.priorityRank ?? Infinity)) {
        return (a.priorityRank ?? Infinity) - (b.priorityRank ?? Infinity)
      }
      if (b.score !== a.score) return b.score - a.score
      if (b.liveJobs !== a.liveJobs) return b.liveJobs - a.liveJobs
      return a.slug.localeCompare(b.slug)
    })

  const readyCandidates = baseCandidates.filter((candidate) => candidate.ready)
  const unlockedCount = getUnlockedCount(readyCandidates.length, now)
  const unlockedIds = new Set(
    readyCandidates.slice(0, unlockedCount).map((candidate) => candidate.companyId),
  )
  const rolloutRankById = new Map(
    readyCandidates.map((candidate, index) => [candidate.companyId, index + 1] as const),
  )

  const candidates = baseCandidates.map((candidate) => ({
    ...candidate,
    rolloutRank: rolloutRankById.get(candidate.companyId) ?? null,
    unlocked: unlockedIds.has(candidate.companyId),
  }))

  return {
    batchDays: COMPANY_PSEO_BATCH_DAYS,
    batchSize: COMPANY_PSEO_BATCH_SIZE,
    readyCount: readyCandidates.length,
    unlockedCount,
    nextUnlockAt: getNextUnlockAt(readyCandidates.length, unlockedCount, now),
    candidates,
  }
}

export const getCompanyPublishingManifest = unstable_cache(
  async () => buildCompanyPublishingManifestData(new Date()),
  ['company-pseo-manifest-v1'],
  { revalidate: 3600, tags: ['company-pseo', 'sitemap'] },
)

export async function getCompanyPublishingDecision(slug: string) {
  const manifest = await getCompanyPublishingManifest()
  return (
    manifest.candidates.find((candidate) => candidate.slug === slug) ?? {
      companyId: '',
      slug,
      name: slug,
      priorityRank: getPriorityCompanyRank(slug),
      liveJobs: 0,
      salaryBackedJobs: 0,
      enrichedJobs: 0,
      richJobContentJobs: 0,
      roleDiversity: 0,
      locationDiversity: 0,
      metadataSignals: 0,
      score: 0,
      ready: false,
      reasons: ['not_in_company_manifest'],
      rolloutRank: null,
      unlocked: false,
      latestUpdatedAt: new Date(0).toISOString(),
    }
  )
}

export async function getPublishedCompanyCandidatesPage(
  page: number,
  pageSize: number,
): Promise<CompanyPublishingCandidate[]> {
  const manifest = await getCompanyPublishingManifest()
  if (page < 1 || pageSize < 1) return []

  const published = manifest.candidates.filter((candidate) => candidate.unlocked)
  const start = (page - 1) * pageSize
  return published.slice(start, start + pageSize)
}

export async function getPublishedCompanyCandidateCount(): Promise<number> {
  const manifest = await getCompanyPublishingManifest()
  return manifest.unlockedCount
}

export async function getPriorityPublishedCompanyCandidates(
  limit: number,
): Promise<CompanyPublishingCandidate[]> {
  const manifest = await getCompanyPublishingManifest()
  return manifest.candidates
    .filter((candidate) => candidate.unlocked)
    .filter((candidate) => candidate.priorityRank !== null)
    .sort((a, b) => {
      if ((a.priorityRank ?? Infinity) !== (b.priorityRank ?? Infinity)) {
        return (a.priorityRank ?? Infinity) - (b.priorityRank ?? Infinity)
      }
      if (b.score !== a.score) return b.score - a.score
      return a.slug.localeCompare(b.slug)
    })
    .slice(0, Math.max(0, limit))
}

export { buildCompanyPublishingManifestData }
