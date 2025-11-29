import type { Job, Company, Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { getDateThreshold, MAX_DISPLAY_AGE_DAYS } from '../ingest/jobAgeFilter'
import type { JobWithCompany } from '../../../lib/jobs/queryJobs'

jobs.map((j: JobWithCompany) => {
  // ...
})

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
  companySlug?: string
  isHundredKLocal?: boolean
  maxJobAgeDays?: number

  seniorityLevels?: string[]
  employmentTypes?: string[]
  remoteMode?: 'remote' | 'hybrid' | 'onsite'
  companySizeBuckets?: string[]
  
  // NEW: SEO filters
  experienceLevel?: string
  industry?: string
  workArrangement?: string
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
  const page = Math.max(1, input.page || 1)
  const pageSize = Math.min(Math.max(input.pageSize || 20, 1), 100)

  const where = buildWhere(input)

  const isMinSalaryFilter = typeof input.minAnnual === "number" && input.minAnnual > 100_000
  const orderBy: Prisma.JobOrderByWithRelationInput[] = isMinSalaryFilter
    ? [
        { minAnnual: "desc" },
        { maxAnnual: "desc" },
        { postedAt: "desc" },
        { createdAt: "desc" },
      ]
    : [
        { maxAnnual: "desc" },
        { minAnnual: "desc" },
        { postedAt: "desc" },
        { createdAt: "desc" },
      ]

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
      { postedAt: null, createdAt: { gte: getDateThreshold(MAX_DISPLAY_AGE_DAYS) } },
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

  if (filters.remoteMode) {
    where.remoteMode = filters.remoteMode
  }

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

  if (filters.seniorityLevels?.length) {
    const roleInferenceFilter: Prisma.RoleInferenceWhereInput = {
      seniority: { in: filters.seniorityLevels },
    }
    where.roleInference = roleInferenceFilter
  }

  if (filters.employmentTypes?.length) {
    where.type = { in: filters.employmentTypes }
  }

  if (filters.skillSlugs?.length) {
    const ors = filters.skillSlugs.map((slug) => ({
      skillsJson: { contains: slug },
    }))
    addAnd({ OR: ors })
  }

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