// lib/jobs/queryJobs.ts

import type { Job, Company, Prisma, RoleInference } from '@prisma/client'
import { prisma } from '../prisma'
import { getDateThreshold, MAX_DISPLAY_AGE_DAYS } from '../ingest/jobAgeFilter'
import { HIGH_SALARY_THRESHOLDS } from '../currency/thresholds'
import { inferCurrencyFromCountryCode } from '../normalizers/salary'
import { getMinSalaryForCountry } from './salaryThresholds'

export type JobWithCompany = Job & {
  companyRef: Company | null
  roleInference?: RoleInference | null
}

export type JobQueryInput = {
  page?: number
  pageSize?: number
  selectMode?: 'listing' | 'full'

  roleSlugs?: string[]
  skillSlugs?: string[]
  tech?: string
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

const jobListingSelect = {
  id: true,
  title: true,
  company: true,
  companyLogo: true,
  companyId: true,
  source: true,
  roleSlug: true,
  externalId: true,
  url: true,
  applyUrl: true,
  postedAt: true,
  createdAt: true,
  updatedAt: true,
  isHighSalary: true,
  isHundredKLocal: true,
  isHighSalaryLocal: true,
  salaryRaw: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  salaryPeriod: true,
  minAnnual: true,
  maxAnnual: true,
  currency: true,
  salaryValidated: true,
  type: true,
  employmentType: true,
  experienceLevel: true,
  industry: true,
  workArrangement: true,
  workArrangementNormalized: true,
  remote: true,
  remoteMode: true,
  remoteRegion: true,
  locationRaw: true,
  city: true,
  citySlug: true,
  stateCode: true,
  countryCode: true,
  primaryLocation: true,
  locationsJson: true,
  benefitsJson: true,
  aiBenefits: true,
  aiSnippet: true,
  aiOneLiner: true,
  skillsJson: true,
  techStack: true,
  companyRef: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      website: true,
    },
  },
} satisfies Prisma.JobSelect

const jobFullSelect = {
  ...jobListingSelect,
  salaryConfidence: true,
  companyRef: {
    select: {
      ...jobListingSelect.companyRef.select,
      sizeBucket: true,
      industry: true,
    },
  },
  roleInference: true,
} satisfies Prisma.JobSelect

export async function queryJobs(input: JobQueryInput): Promise<JobQueryResult> {
  const debugTiming =
    process.env.DEBUG_DB_TIMING === '1' ||
    process.env.DEBUG_QUERY_TIMES === '1'

  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100)

  // Defaults applied here so buildWhere + ordering logic both see them
  const normalizedInput: JobQueryInput = {
    ...input,
    selectMode: input.selectMode ?? 'listing',
    sortBy: input.sortBy ?? 'salary',
    excludeInternships: input.excludeInternships ?? true,
  }

  const where = buildWhere(normalizedInput)
  const sortBy = normalizedInput.sortBy ?? 'salary'
  const select =
    normalizedInput.selectMode === 'full' ? jobFullSelect : jobListingSelect

  let orderBy: Prisma.JobOrderByWithRelationInput[]

  if (sortBy === 'date') {
    // ✅ Date-first ranking - prioritize when WE scraped it (createdAt)
    orderBy = [
      { createdAt: 'desc' }, // FIRST: When we scraped it (most accurate)
      { updatedAt: 'desc' }, // SECOND: When job was updated
      { postedAt: 'desc' }, // THIRD: Company's post date (fallback)
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

  const t0 = debugTiming ? Date.now() : 0
  let countMs = 0
  let findMs = 0

  const countP = (async () => {
    const s = debugTiming ? Date.now() : 0
    const out = await prisma.job.count({ where })
    if (debugTiming) countMs = Date.now() - s
    return out
  })()

  const findP = (async () => {
    const s = debugTiming ? Date.now() : 0
    const out = await prisma.job.findMany({
      where,
      select,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    if (debugTiming) findMs = Date.now() - s
    return out
  })()

  const [total, jobs] = await Promise.all([countP, findP])

  if (debugTiming) {
    const ms = Date.now() - t0
    const gate = {
      page,
      pageSize,
      sortBy,
      role: input.roleSlugs?.length ? input.roleSlugs.join(',') : undefined,
      country: input.countryCode,
      city: input.citySlug,
      remoteOnly: input.remoteOnly ? '1' : undefined,
      remoteMode: input.remoteMode,
      remoteRegion: input.remoteRegion,
      company: input.companySlug,
    }
    console.log(
      '[db] queryJobs ms=%d countMs=%d findMs=%d meta=%s',
      ms,
      countMs,
      findMs,
      JSON.stringify(gate),
    )
  }

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

  // 🔒 Annual salary sanity guard (blocks monthly / low local salaries)
  addAnd({
    OR: [
      { minAnnual: { gte: BigInt(50000) } },
      { maxAnnual: { gte: BigInt(50000) } },
    ],
  });

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

  const requestedCurrency = filters.currency
    ? filters.currency.toUpperCase()
    : null

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

  // Salary range filters (ensure we have a currency when min/max is provided)
  const hasMinAnnual =
    typeof filters.minAnnual === 'number' && filters.minAnnual > 0
  const hasMaxAnnual =
    typeof filters.maxAnnual === 'number' && filters.maxAnnual > 0
  const hasAnnualFilter = hasMinAnnual || hasMaxAnnual

  let annualCurrency = requestedCurrency

  if (hasAnnualFilter && !annualCurrency) {
    const inferred = filters.countryCode
      ? inferCurrencyFromCountryCode(filters.countryCode)
      : null
    annualCurrency = inferred || 'USD'
  }

  if (annualCurrency) {
    where.currency = annualCurrency
  }

  const hasCurrencyFilter = Boolean(annualCurrency)
  const localThreshold =
    filters.isHundredKLocal && filters.countryCode
      ? getMinSalaryForCountry(filters.countryCode)
      : null
  const effectiveMinAnnual =
    hasMinAnnual &&
    localThreshold &&
    filters.minAnnual != null &&
    filters.minAnnual <= 100_000
      ? localThreshold
      : filters.minAnnual

  if (
    hasCurrencyFilter &&
    typeof effectiveMinAnnual === 'number' &&
    effectiveMinAnnual > 0
  ) {
    const min = effectiveMinAnnual
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
    const max = BigInt(filters.maxAnnual)
    addAnd({
      OR: [
        { maxAnnual: { lte: max } },
        { maxAnnual: null, minAnnual: { lte: max } },
      ],
    })
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

  if (filters.tech) {
    const tech = String(filters.tech).trim()
    if (tech) {
      addAnd({
        OR: [
          { techStack: { contains: tech, mode: 'insensitive' } },
          { skillsJson: { contains: tech, mode: 'insensitive' } },
        ],
      })
    }
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
      { minAnnual: { gte: threshold } },
      { maxAnnual: { gte: threshold } },
    ]
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
