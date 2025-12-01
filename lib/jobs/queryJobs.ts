// lib/jobs/queryJobs.ts

import type { Job, Company, Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { getDateThreshold, MAX_DISPLAY_AGE_DAYS } from '../ingest/jobAgeFilter'

export type JobWithCompany = Job & { companyRef: Company | null }

export type JobQueryInput = {
  page?: number
  pageSize?: number

  roleSlugs?: string[]
  skillSlugs?: string[]
  minAnnual?: number
  maxAnnual?: number
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
  //  - 'salary' (default) → salary-first ranking
  //  - 'date' → newest jobs first
  sortBy?: 'salary' | 'date'
  // If not provided, we default to true in queryJobs()
  excludeInternships?: boolean
}

export type JobQueryResult = {
  jobs: JobWithCompany[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function queryJobs(
  input: JobQueryInput
): Promise<JobQueryResult> {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100)

  // Apply defaults here so buildWhere + ordering logic both see them
  const normalizedInput: JobQueryInput = {
    ...input,
    sortBy: input.sortBy ?? 'salary',
    excludeInternships: input.excludeInternships ?? true,
  }

  const where = buildWhere(normalizedInput)

  const sortBy = normalizedInput.sortBy ?? 'salary'

  let orderBy: Prisma.JobOrderByWithRelationInput[]

  if (sortBy === 'date') {
    // For "Latest $100k+ jobs" etc.
    orderBy = [
      { postedAt: 'desc' },
      { createdAt: 'desc' },
      { maxAnnual: 'desc' },
      { minAnnual: 'desc' },
    ]
  } else {
    // Default behaviour – salary-first
    const isMinSalaryFilter =
      typeof normalizedInput.minAnnual === 'number' &&
      normalizedInput.minAnnual > 100_000

    orderBy = isMinSalaryFilter
      ? [
          { minAnnual: 'desc' },
          { maxAnnual: 'desc' },
          { postedAt: 'desc' },
          { createdAt: 'desc' },
        ]
      : [
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
    jobs,
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 1 : Math.ceil(total / pageSize),
  }
}

export function buildWhere(
  filters: JobQueryInput
): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = {
    isExpired: false,
    OR: [
      { postedAt: { gte: getDateThreshold(MAX_DISPLAY_AGE_DAYS) } },
      {
        postedAt: null,
        createdAt: { gte: getDateThreshold(MAX_DISPLAY_AGE_DAYS) },
      },
    ],
  }

  const addAnd = (clause: Prisma.JobWhereInput) => {
    if (!where.AND) {
      where.AND = [clause]
    } else if (Array.isArray(where.AND)) {
      where.AND.push(clause)
    } else {
      where.AND = [where.AND, clause]
    }
  }

  // Role / basic filters
  if (filters.roleSlugs?.length) {
    addAnd({
      OR: filters.roleSlugs.map((slug) => ({
        roleSlug: { contains: slug },
      })),
    })
  }

  if (filters.countryCode) {
    where.countryCode = filters.countryCode.toUpperCase()
  }

  if (filters.citySlug) {
    where.citySlug = filters.citySlug
  }

  if (filters.remoteOnly) {
    where.remote = true
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

  // Salary filters / 100k logic
  if (typeof filters.minAnnual === 'number' && filters.minAnnual > 0) {
    const min = filters.minAnnual

    if (min <= 100_000 && filters.isHundredKLocal !== false) {
      addAnd({
        OR: [
          { minAnnual: { gte: BigInt(min) } },
          { isHundredKLocal: true },
        ],
      })
    } else {
      addAnd({ minAnnual: { gte: BigInt(min) } })
    }
  } else if (filters.isHundredKLocal === true) {
    addAnd({ isHundredKLocal: true })
  }

  if (typeof filters.maxAnnual === 'number' && filters.maxAnnual > 0) {
    where.maxAnnual = { lte: BigInt(filters.maxAnnual) }
  }

  if (filters.maxJobAgeDays && filters.maxJobAgeDays > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filters.maxJobAgeDays)
    where.postedAt = { gte: cutoff }
  }

  // Seniority via RoleInference relation
  if (filters.seniorityLevels?.length) {
    const roleInferenceFilter: Prisma.RoleInferenceWhereInput = {
      seniority: { in: filters.seniorityLevels },
    }
    where.roleInference = roleInferenceFilter
  }

  // Employment type + internship exclusion
  if (filters.employmentTypes?.length) {
    // Caller wants explicit types → respect that
    where.type = { in: filters.employmentTypes }
  } else if (filters.excludeInternships) {
    // Generic “no internships” filter – use title, case-insensitive
    addAnd({
      NOT: [
        { title: { contains: 'Intern' } },
        { title: { contains: 'intern' } },
      ],
    })
  }

  // Skills
  if (filters.skillSlugs?.length) {
    const ors = filters.skillSlugs.map((slug) => ({
      skillsJson: { contains: slug },
    }))
    addAnd({ OR: ors })
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
