// lib/jobs/queryJobs.ts

import type { Job, Company, Prisma, RoleInference } from '@prisma/client'
import { prisma } from '../prisma'
import { getDateThreshold, MAX_DISPLAY_AGE_DAYS } from '../ingest/jobAgeFilter'
import { HIGH_SALARY_THRESHOLDS } from '../currency/thresholds'
import { inferCurrencyFromCountryCode } from '../normalizers/salary'
import { getMinSalaryForCountry } from './salaryThresholds'
import { buildFreshJobWhere } from './freshness'
import { buildKeywordPlan, scoreJob, tokenize, wordStartPatterns, type KeywordPlan } from '../search/keywordPlan'
import { getSearchVocabulary } from '../search/vocabulary'
import { skillStoredTokens } from '../seo/pseoTargets'
import { remoteRegionWhere } from './remoteRegions'
import { noDegreeRequiredWhere, type DegreeRequiredJobs } from './degreeRequirement'
import { fourDayWeekWhere, type FourDayWeekListing } from './fourDayWeek'
import { degreeRequirement } from './degreeRequirement'
import { extractBenefits, extractExperience, summarizeRole } from './jobSummary'
import { loadPeerSalaries, rankSalary } from './salaryRank'
import { salaryMidpoint } from './salarySnapshot'
import { resolveJobRoleSlug } from '../roles/indexableRole'
import { roleLabelFor } from '../roles/relatedRoles'
import { NEW_TAG_WINDOW_MS } from './postedRecently'

export type JobWithCompany = Job & {
  companyRef: Company | null
  roleInference?: RoleInference | null
  /** What the job is, read from its description (see lib/jobs/jobSummary.ts); the listing query does not load descriptions. */
  cardSummary?: string | null
  /** Benefits the description names ("Equity", "401(k)", "Unlimited PTO"...). */
  cardBenefits?: string[]
  /** Experience the description asks for ("5+ years", "3–5 years"). */
  cardExperience?: string | null
  /** What the description says about a degree; 'not_mentioned' is left out of the page. */
  cardDegree?: 'required' | 'equivalent_accepted' | 'not_mentioned'
  /** Where the pay sits among live listings for the same role in the same currency. */
  cardPayRank?: { percent: number; peers: number; role: string } | null
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
  /** 'relevant' ranks keyword matches (title > company > skills); without a keyword it behaves like 'salary'. */
  sortBy?: 'salary' | 'date' | 'relevant'
  excludeInternships?: boolean

  // Specialty filters
  visaSponsorship?: boolean
  /**
   * Only jobs whose description asks for no degree, or accepts equivalent experience: pass the latest
   * loadDegreeRequiredJobIds() result (lib/jobs/degreeRequirement.ts).
   */
  noDegreeRequired?: DegreeRequiredJobs
  /** Four-day-week jobs: the labelled 4dayweek.io listings (lib/jobs/fourDayWeek.ts). */
  fourDayWeek?: readonly FourDayWeekListing[]

  // Keyword search (title / company name contains)
  keyword?: string
  /** Set by queryJobs from `keyword` (aliases + typo corrections); callers normally leave it unset. */
  keywordPlan?: KeywordPlan
  /** Fields the keyword is matched in (default: all of KEYWORD_FIELDS). The job page's similar jobs use the title only. */
  keywordFields?: readonly KeywordField[]
}

export type JobQueryResult = {
  jobs: JobWithCompany[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  /** Present when a keyword search was corrected, so the page can say what was actually searched. */
  search?: { corrections: Array<{ from: string; to: string }> }
}

export const jobListingSelect = {
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
  visaSponsorship: true,
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

/**
 * Adds `cardSummary` and `cardBenefits` to a page of listing jobs: one extra query for just these jobs' descriptions,
 * read on the server so the descriptions themselves never reach the browser. A failure leaves the jobs as they were.
 */
async function withCardSummaries<
  T extends { id: string; title?: string | null; company?: string | null; roleSlug?: string | null; currency?: string | null; minAnnual?: bigint | number | null; maxAnnual?: bigint | number | null },
>(jobs: T[]): Promise<T[]> {
  if (jobs.length === 0) return jobs
  try {
    const rows = await prisma.job.findMany({ where: { id: { in: jobs.map((j) => j.id) } }, select: { id: true, descriptionHtml: true } })
    const html = new Map(rows.map((r) => [r.id, r.descriptionHtml]))
    // Peer salaries per role and currency are cached for 10 minutes (loadPeerSalaries), so a page costs at most one
    // query per role it shows, and usually none.
    const ranks = await Promise.all(
      jobs.map(async (j) => {
        const mine = salaryMidpoint(j.minAnnual ?? null, j.maxAnnual ?? null)
        // The role as the job page resolves it: most jobs are stored as "other", so the title is read when it is.
        // No real role, no comparison ("Pays more than 80% of Other jobs" said nothing).
        const role = resolveJobRoleSlug(j)
        if (!role || !j.currency || mine == null) return null
        const rank = rankSalary(mine, await loadPeerSalaries(role, j.currency).catch(() => []))
        return rank ? { percent: rank.percent, peers: rank.peers, role: roleLabelFor(role) } : null
      }),
    )
    return jobs.map((j, i) => {
      const d = html.get(j.id)
      return {
        ...j,
        cardPayRank: ranks[i],
        ...(d
          ? {
              cardSummary: summarizeRole(d, { company: j.company }),
              cardBenefits: extractBenefits(d),
              cardExperience: extractExperience(d),
              cardDegree: degreeRequirement(d),
            }
          : {}),
      }
    })
  } catch {
    return jobs
  }
}

/** Most matches ranked per search; beyond this, results are ordered by recency instead of score. */
const RELEVANCE_CANDIDATE_CAP = 1500

/**
 * Pure: "Most relevant" order. Jobs that carry the "New" tag (posted within NEW_TAG_WINDOW_MS) come first, so a fresh
 * match is not buried mid-list under older ones (owner's request, 2026-11-12); within each group the higher keyword score
 * leads, then the newer posting date, then id.
 */
export function rankByRelevance(rows: Array<{ id: string; score: number; posted: number }>, now: number): string[] {
  return rows
    .map((r) => ({ ...r, fresh: now - r.posted < NEW_TAG_WINDOW_MS ? 1 : 0 }))
    .sort((a, b) => b.fresh - a.fresh || b.score - a.score || b.posted - a.posted || (a.id < b.id ? -1 : 1))
    .map((r) => r.id)
}

/**
 * Keyword results ordered by relevance. Prisma cannot order by a computed score, so the matching rows' searchable
 * fields are scored here (cheap: only a few short columns, capped at RELEVANCE_CANDIDATE_CAP newest matches), the
 * requested page is cut from the ranking, and just those jobs are loaded in full.
 */
async function queryByRelevance(args: {
  where: Prisma.JobWhereInput
  select: typeof jobListingSelect | typeof jobFullSelect
  keywordPlan: KeywordPlan
  page: number
  pageSize: number
}): Promise<JobQueryResult> {
  const { where, select, keywordPlan, page, pageSize } = args
  const [total, candidates] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      select: {
        id: true,
        title: true,
        company: true,
        locationRaw: true,
        techStack: true,
        skillsJson: true,
        createdAt: true,
        postedAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: RELEVANCE_CANDIDATE_CAP,
    }),
  ])

  const ranked = rankByRelevance(
    candidates.map((c) => ({ id: c.id, score: scoreJob(keywordPlan, c), posted: (c.postedAt ?? c.createdAt).getTime() })),
    Date.now(),
  )
  const pageIds = ranked.slice((page - 1) * pageSize, page * pageSize)

  const rows = pageIds.length ? await prisma.job.findMany({ where: { id: { in: pageIds } }, select }) : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  const jobs = pageIds.map((id) => byId.get(id)).filter(Boolean)

  return {
    jobs: (pageSize > 1 ? await withCardSummaries(jobs as any[]) : jobs) as unknown as JobWithCompany[],
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 1 : Math.ceil(total / pageSize),
    ...(keywordPlan.corrections.length > 0 ? { search: { corrections: keywordPlan.corrections } } : {}),
  }
}

/**
 * Pure: the ids of one page in "Most Recent" order, newest posting date first. A job's posting date is postedAt (the
 * employer's date) or, when the source gave none, createdAt (the day we first saw it), the same rule as "new this
 * week" (lib/jobs/postedRecently.ts). Each list is already newest first; ties keep the dated job first, then id.
 */
export function mergeByPostingDate(
  dated: Array<{ id: string; at: Date }>,
  undated: Array<{ id: string; at: Date }>,
  skip: number,
  take: number,
): string[] {
  const out: string[] = []
  let i = 0
  let j = 0
  while (out.length < skip + take && (i < dated.length || j < undated.length)) {
    const a = dated[i]
    const b = undated[j]
    if (b === undefined || (a !== undefined && a.at.getTime() >= b.at.getTime())) {
      out.push(a.id)
      i++
    } else {
      out.push(b.id)
      j++
    }
  }
  return out.slice(skip)
}

/**
 * "Most Recent": newest posting date first. It used to order by createdAt (when we first saw a job) while rows show the
 * posting date, so a 2023 posting found yesterday led the list. Prisma cannot order by COALESCE(postedAt, createdAt),
 * so the newest dated and undated jobs are read separately (ids and dates only) and merged.
 */
async function queryByPostingDate(args: {
  where: Prisma.JobWhereInput
  select: typeof jobListingSelect | typeof jobFullSelect
  page: number
  pageSize: number
}): Promise<JobQueryResult> {
  const { where, select, page, pageSize } = args
  const skip = (page - 1) * pageSize
  const need = skip + pageSize
  const [total, dated, undated] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where: { AND: [where, { postedAt: { not: null } }] },
      select: { id: true, postedAt: true },
      orderBy: [{ postedAt: 'desc' }, { id: 'asc' }],
      take: need,
    }),
    prisma.job.findMany({
      where: { AND: [where, { postedAt: null }] },
      select: { id: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: need,
    }),
  ])

  const pageIds = mergeByPostingDate(
    dated.map((r) => ({ id: r.id, at: r.postedAt as Date })),
    undated.map((r) => ({ id: r.id, at: r.createdAt })),
    skip,
    pageSize,
  )
  const rows = pageIds.length ? await prisma.job.findMany({ where: { id: { in: pageIds } }, select }) : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  const jobs = pageIds.map((id) => byId.get(id)).filter(Boolean)

  return {
    jobs: (pageSize > 1 ? await withCardSummaries(jobs as any[]) : jobs) as unknown as JobWithCompany[],
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 1 : Math.ceil(total / pageSize),
  }
}

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

  // Aliases and typo corrections for a keyword search. A failure here (e.g. the vocabulary query) must never break
  // the search itself, so it falls back to the plain keyword.
  let keywordPlan = input.keywordPlan
  if (!keywordPlan && input.keyword?.trim()) {
    try {
      keywordPlan = buildKeywordPlan(input.keyword, await getSearchVocabulary())
    } catch {
      keywordPlan = buildKeywordPlan(input.keyword, null)
    }
  }

  const where = buildWhere({ ...normalizedInput, keywordPlan })
  const sortBy = normalizedInput.sortBy ?? 'salary'
  const select =
    normalizedInput.selectMode === 'full' ? jobFullSelect : jobListingSelect

  if (sortBy === 'relevant' && keywordPlan) {
    return queryByRelevance({ where, select, keywordPlan, page, pageSize })
  }

  if (sortBy === 'date') {
    return queryByPostingDate({ where, select, page, pageSize })
  }

  // Salary-first ranking
  const orderBy: Prisma.JobOrderByWithRelationInput[] = [
    { maxAnnual: 'desc' },
    { minAnnual: 'desc' },
    { postedAt: 'desc' },
    { createdAt: 'desc' },
  ]

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
    jobs: (pageSize > 1 ? await withCardSummaries(jobs) : jobs) as JobWithCompany[],
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 1 : Math.ceil(total / pageSize),
    ...(keywordPlan && keywordPlan.corrections.length > 0 ? { search: { corrections: keywordPlan.corrections } } : {}),
  }
}

/** The fields a keyword is searched in. */
const KEYWORD_FIELDS = ['title', 'company', 'locationRaw', 'techStack', 'skillsJson'] as const
export type KeywordField = (typeof KEYWORD_FIELDS)[number]

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
    // A region is a set of countries (lib/jobs/remoteRegions.ts): the stored region column is "Global" on every remote
    // job, so comparing it to "us-only", "emea", ... matched nothing.
    addAnd(remoteRegionWhere(filters.remoteRegion))
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
  // skillsJson is a JSON array of strings, so match the quoted token: a bare `contains: 'java'` also matched
  // "javascript", and 'sql' matched "postgresql" / "mysql".
  if (filters.skillSlugs?.length) {
    addAnd({
      OR: filters.skillSlugs.flatMap((slug) =>
        skillStoredTokens(slug).map((token) => ({
          skillsJson: { contains: `"${token}"`, mode: 'insensitive' as const },
        })),
      ),
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

  if (filters.noDegreeRequired) {
    addAnd(noDegreeRequiredWhere(filters.noDegreeRequired))
  }

  if (filters.fourDayWeek) {
    addAnd(fourDayWeekWhere(filters.fourDayWeek))
  }

  if (filters.keyword) {
    const kw = filters.keyword.trim()
    if (kw) {
      // Match each meaningful word independently (AND) across the searchable fields, so multi-word queries like
      // "senior backend python" match by intent regardless of word order. Each word can also be satisfied by an
      // alias ("frontend" / "front-end") or a typo correction when queryJobs supplied a plan. A word matches where
      // a word of the field starts with it (not inside a word: "seo" is not in "WarehouseOS"), see WORD_BOUNDARIES.
      const plan = filters.keywordPlan
      const terms = plan
        ? plan.terms.map((t) => t.variants)
        : tokenize(kw).map((t) => [t])
      for (const variants of terms) {
        addAnd({
          OR: variants.flatMap((term) =>
            (filters.keywordFields?.length ? filters.keywordFields : KEYWORD_FIELDS).flatMap((field) =>
              wordStartPatterns(term).map((pattern) => ({ [field]: { ...pattern, mode: 'insensitive' as const } }) as Prisma.JobWhereInput),
            ),
          ),
        })
      }
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
