// lib/jobs/queryJobs.ts

import type { Job, Company, Prisma, RoleInference } from '@prisma/client'
import { prisma } from '../prisma'
import { getDateThreshold, MAX_DISPLAY_AGE_DAYS } from '../ingest/jobAgeFilter'
import { HIGH_SALARY_THRESHOLDS } from '../currency/thresholds'
import { inferCurrencyFromCountryCode } from '../normalizers/salary'
import { getMinSalaryForCountry } from './salaryThresholds'
import { buildFreshJobWhere } from './freshness'

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

  // Specialty filters
  visaSponsorship?: boolean

  // Keyword search (title / company name contains)
  keyword?: string
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
  expiresAt: true,
  validThrough: true,
  createdAt: true,
  updatedAt: true,
  isHighSalary: true,
  isHundredKLocal: true,
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
    // Base freshness rule: prefer scrape freshness, then fall back to publish/create dates.
    ...buildFreshJobWhere(MAX_DISPLAY_AGE_DAYS),
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

  if (filters.visaSponsorship === true) {
    where.visaSponsorship = true
  }

  if (filters.keyword) {
    const kw = filters.keyword.trim()
    if (kw) {
      addAnd({
        OR: [
          { title: { contains: kw, mode: 'insensitive' } },
          { company: { contains: kw, mode: 'insensitive' } },
          { locationRaw: { contains: kw, mode: 'insensitive' } },
          { techStack: { contains: kw, mode: 'insensitive' } },
          { skillsJson: { contains: kw, mode: 'insensitive' } },
        ],
      })
    }
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

// Tokens that mark a job as something we never surface (interns, contracts,
// part-time, etc.). Kept as a flat list so the SQL stays one `LIKE ANY (...)`
// equivalent per column instead of many separate NOT branches.
const EXCLUDED_TITLE_TOKENS = [
  'intern',
  'internship',
  'junior',
  ' jr',
  'jr.',
  'entry',
  'entry level',
  'graduate',
  'new grad',
  'new-gr',
  '(new grad',
  'new graduate',
  'phd graduate',
]

const EXCLUDED_EMPLOYMENT_TOKENS = ['part-time', 'part time', 'contract', 'temporary']

// Wrap each NOT-contains check in an `OR field is null` so jobs with null
// employmentType/type aren't silently filtered out. Prisma's `NOT: [...]`
// of `contains` evaluates to NULL (filter-out) when the column is NULL —
// that was masking a huge number of legitimate jobs (e.g. Stripe had 19/20
// salary-validated roles dropped because employmentType was null even
// though the job was full-time).
// title is non-nullable on Job — a straight NOT contains is correct.
function titleNotContains(token: string): Prisma.JobWhereInput {
  return { title: { not: { contains: token }, mode: 'insensitive' } }
}

// type / employmentType are nullable. Prisma's `NOT contains` evaluates to
// NULL (filter-out) when the column itself is NULL, so we have to explicitly
// allow nulls with an OR. That was the Stripe display-gate bug: 19/20
// salary-validated Stripe jobs had `employmentType=null` and were being
// dropped by `NOT { employmentType: { contains: 'part-time' } }`.
function typeNotContains(token: string): Prisma.JobWhereInput {
  return {
    OR: [
      { type: { equals: null } },
      { type: { not: { contains: token }, mode: 'insensitive' } },
    ],
  }
}
function employmentTypeNotContains(token: string): Prisma.JobWhereInput {
  return {
    OR: [
      { employmentType: { equals: null } },
      { employmentType: { not: { contains: token }, mode: 'insensitive' } },
    ],
  }
}

export function buildGlobalExclusionsWhere(): Prisma.JobWhereInput {
  return {
    AND: [
      ...EXCLUDED_TITLE_TOKENS.map(titleNotContains),
      ...EXCLUDED_EMPLOYMENT_TOKENS.map(typeNotContains),
      ...EXCLUDED_EMPLOYMENT_TOKENS.map(employmentTypeNotContains),
    ],
  }
}
