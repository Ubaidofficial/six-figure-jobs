// lib/jobs/queryJobs.ts

import type { Job, Company, Prisma, RoleInference } from '@prisma/client'
import { prisma } from '../prisma'
import { getDateThreshold, MAX_DISPLAY_AGE_DAYS } from '../ingest/jobAgeFilter'
import { HIGH_SALARY_THRESHOLDS } from '../currency/thresholds'

export type JobWithCompany = Job & {
  companyRef: Company | null
  roleInference?: RoleInference | null
}

export type JobQueryInput = {
  page?: number
  pageSize?: number

  roleSlugs?: string[]
  skillSlugs?: string[]
  stateCode?: string
  minAnnual?: number
  maxAnnual?: number
  currency?: string
  countryCode?: string
  citySlug?: string
  remoteOnly?: boolean
  remoteRegion?: string
  companySlug?: string
  isHundredKLocal?: boolean
  maxJobAgeDays?: number

  seniorityLevels?: string[]
  employmentTypes?: string[]
  remoteMode?: 'remote' | 'hybrid' | 'onsite'
  companySizeBuckets?: string[]

  // SEO filters
  experienceLevel?: string
  industry?: string
  workArrangement?: string

  // Control ordering and internship leakage
  sortBy?: 'salary' | 'date'
  excludeInternships?: boolean
}

export type JobQueryResult = {
  jobs: JobWithCompany[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function queryJobs(input: JobQueryInput): Promise<JobQueryResult> {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100)

  // Defaults applied here so buildWhere + ordering logic both see them
  const normalizedInput: JobQueryInput = {
    ...input,
    sortBy: input.sortBy ?? 'salary',
    excludeInternships: input.excludeInternships ?? true,
  }

  const where = buildWhere(normalizedInput)
  const sortBy = normalizedInput.sortBy ?? 'salary'

  let orderBy: Prisma.JobOrderByWithRelationInput[]

  if (sortBy === 'date') {
    // ✅ Date-first ranking (postedAt if available, otherwise updatedAt/createdAt)
    orderBy = [
      { postedAt: 'desc' },
      { updatedAt: 'desc' }, // ✅ critical for ATS feeds where postedAt is null
      { createdAt: 'desc' },
      { maxAnnual: 'desc' },
      { minAnnual: 'desc' },
    ]
  } else {
    // Salary-first ranking
    orderBy = [
      { maxAnnual: 'desc' },
      { minAnnual: 'desc' },
      { postedAt: 'desc' },
      { createdAt: 'desc' },
    ]
  }

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      include: { companyRef: true, roleInference: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return {
    jobs: jobs as JobWithCompany[],
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 1 : Math.ceil(total / pageSize),
  }
}

export function buildWhere(filters: JobQueryInput): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = {
    isExpired: false,
    // Base freshness rule (keep this as OR to support postedAt null)
    OR: [
      { postedAt: { gte: getDateThreshold(MAX_DISPLAY_AGE_DAYS) } },
      {
        postedAt: null,
        createdAt: { gte: getDateThreshold(MAX_DISPLAY_AGE_DAYS) },
      },
    ],
  }

  const addAnd = (clause: Prisma.JobWhereInput) => {
    if (!where.AND) where.AND = [clause]
    else if (Array.isArray(where.AND)) where.AND.push(clause)
    else where.AND = [where.AND, clause]
  }

  // v2.9 hard gates (canonical, deterministic)
  addAnd(buildHighSalaryEligibilityWhere())

  // Global exclusions (never show anywhere)
  addAnd(buildGlobalExclusionsWhere())

  // Role / basic filters
  if (filters.roleSlugs?.length) {
    addAnd({
      OR: filters.roleSlugs.map((slug) => ({
        OR: [{ roleSlug: slug }, { roleSlug: { contains: slug } }],
      })),
    })
  }

  if (filters.countryCode) {
    where.countryCode = filters.countryCode.toUpperCase()
  }

  if (filters.currency) {
    where.currency = filters.currency.toUpperCase()
  }

  if (filters.stateCode) {
    where.stateCode = filters.stateCode.toUpperCase()
  }

  if (filters.citySlug) {
    where.citySlug = filters.citySlug
  }

  if (filters.remoteOnly) {
    addAnd({ OR: [{ remote: true }, { remoteMode: 'remote' }] })
  }

  if (filters.remoteRegion) {
    where.remoteRegion = filters.remoteRegion
  }

  if (filters.remoteMode) {
    where.remoteMode = filters.remoteMode
  }

  // Company filters
  let companyFilter: Prisma.CompanyWhereInput | undefined

  if (filters.companySlug) {
    companyFilter = {
      ...(companyFilter ?? {}),
      slug: filters.companySlug,
    }
  }

  if (filters.companySizeBuckets?.length) {
    companyFilter = {
      ...(companyFilter ?? {}),
      sizeBucket: { in: filters.companySizeBuckets },
    }
  }

  if (companyFilter) {
    where.companyRef = companyFilter
  }

  // Salary range filters (only safe when caller pins currency)
  const hasCurrencyFilter = Boolean(filters.currency)
  if (
    hasCurrencyFilter &&
    typeof filters.minAnnual === 'number' &&
    filters.minAnnual > 0
  ) {
    const min = filters.minAnnual
    addAnd({
      OR: [
        { minAnnual: { gte: BigInt(min) } },
        { maxAnnual: { gte: BigInt(min) } },
      ],
    })
  }

  if (
    hasCurrencyFilter &&
    typeof filters.maxAnnual === 'number' &&
    filters.maxAnnual > 0
  ) {
    where.maxAnnual = { lte: BigInt(filters.maxAnnual) }
  }

  // IMPORTANT: do NOT overwrite where.postedAt (it breaks the base OR)
  if (filters.maxJobAgeDays && filters.maxJobAgeDays > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filters.maxJobAgeDays)

    addAnd({
      OR: [
        { postedAt: { gte: cutoff } },
        { postedAt: null, createdAt: { gte: cutoff } },
      ],
    })
  }

  // Seniority via RoleInference relation
  if (filters.seniorityLevels?.length) {
    where.roleInference = {
      seniority: { in: filters.seniorityLevels },
    }
  }

  // Employment type + optional internship exclusion (kept for legacy call sites)
  if (filters.employmentTypes?.length) {
    where.type = { in: filters.employmentTypes }
  } else if (filters.excludeInternships) {
    // Intern is excluded globally below; keep for backward-compat.
  }

  // Skills
  if (filters.skillSlugs?.length) {
    addAnd({
      OR: filters.skillSlugs.map((slug) => ({
        skillsJson: { contains: slug },
      })),
    })
  }

  // Extra SEO-ish filters
  if (filters.experienceLevel) {
    where.experienceLevel = filters.experienceLevel
  }

  if (filters.industry) {
    where.industry = filters.industry
  }

  if (filters.workArrangement) {
    where.workArrangement = filters.workArrangement
  }

  return where
}

export const HIGH_SALARY_MIN_CONFIDENCE = 80

export function buildHighSalaryEligibilityWhere(): Prisma.JobWhereInput {
  const currencyClauses: Prisma.JobWhereInput[] = Object.entries(
    HIGH_SALARY_THRESHOLDS,
  ).map(([currency, threshold]) => ({
    currency,
    OR: [
      { maxAnnual: { gte: BigInt(threshold) } },
      { minAnnual: { gte: BigInt(threshold) } },
    ],
  }))

  return {
    salaryValidated: true,
    salaryConfidence: { gte: HIGH_SALARY_MIN_CONFIDENCE },
    OR: currencyClauses,
  }
}

export function buildGlobalExclusionsWhere(): Prisma.JobWhereInput {
  return {
    NOT: [
      { title: { contains: 'intern', mode: 'insensitive' } },
      { title: { contains: 'internship', mode: 'insensitive' } },
      { title: { contains: 'junior', mode: 'insensitive' } },
      { title: { contains: ' jr', mode: 'insensitive' } },
      { title: { contains: 'jr.', mode: 'insensitive' } },
      { title: { contains: 'entry', mode: 'insensitive' } },
      { title: { contains: 'entry level', mode: 'insensitive' } },

      { title: { contains: 'graduate', mode: 'insensitive' } },
      { title: { contains: 'new grad', mode: 'insensitive' } },
      { title: { contains: 'new-gr', mode: 'insensitive' } },
      { title: { contains: '(new grad', mode: 'insensitive' } },
      { title: { contains: 'new graduate', mode: 'insensitive' } },
      { title: { contains: 'phd graduate', mode: 'insensitive' } },

      { type: { contains: 'part-time', mode: 'insensitive' } },
      { type: { contains: 'part time', mode: 'insensitive' } },
      { type: { contains: 'contract', mode: 'insensitive' } },
      { type: { contains: 'temporary', mode: 'insensitive' } },

      { employmentType: { contains: 'part-time', mode: 'insensitive' } },
      { employmentType: { contains: 'part time', mode: 'insensitive' } },
      { employmentType: { contains: 'contract', mode: 'insensitive' } },
      { employmentType: { contains: 'temporary', mode: 'insensitive' } },
    ],
  }
}
