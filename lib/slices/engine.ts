// lib/slices/engine.ts

import { prisma } from '../prisma'

const jobClient = (prisma as any).job
const sliceClient = (prisma as any).slice

export type SliceType =
  | 'role'
  | 'country'
  | 'salary_band'
  | 'company'
  | 'remote'
  | 'role_country'
  | 'role_remote'
  | 'company_role'
  | 'role_country_salary'
  | 'role_remote_salary'

export interface SliceFilters {
  // Role-related
  roleSlug?: string
  baseRoleSlug?: string
  seniority?: string
  discipline?: string

  // Location-related
  country?: string
  isRemote?: boolean | null

  // Company-related
  companyId?: string | number

  // Salary band (assume values already normalized to annual USD in DB)
  minSalaryUsd?: number
  maxSalaryUsd?: number | null
}

/**
 * Shape we expect the Slice table to have in Prisma:
 *
 * model Slice {
 *   id          String   @id @default(cuid())
 *   slug        String   @unique
 *   type        String
 *   filtersJson Json
 *   jobCount    Int
 *   createdAt   DateTime @default(now())
 *   updatedAt   DateTime @updatedAt
 * }
 */
export interface SliceLike {
  id?: string
  slug: string
  type: SliceType | string
  filtersJson: any
  jobCount: number
}

/* ------------------------------------------------------------------ */
/* Core engine                                                        */
/* ------------------------------------------------------------------ */

/**
 * Build a stable slug for a slice from its type + filters.
 * This is the user-facing URL piece and the unique key in DB.
 */
export function buildSliceSlug(type: SliceType, filters: SliceFilters): string {
  const parts: string[] = [type]

  if (filters.roleSlug) parts.push(filters.roleSlug)
  if (filters.baseRoleSlug && !filters.roleSlug) parts.push(filters.baseRoleSlug)
  if (filters.seniority) parts.push(filters.seniority)
  if (filters.discipline) parts.push(filters.discipline)
  if (filters.country) parts.push(slugify(filters.country))
  if (filters.isRemote === true) parts.push('remote')
  if (filters.isRemote === false) parts.push('onsite')
  if (filters.companyId) parts.push(`company-${filters.companyId}`)
  if (typeof filters.minSalaryUsd === 'number') {
    if (typeof filters.maxSalaryUsd === 'number') {
      parts.push(`usd-${filters.minSalaryUsd}-${filters.maxSalaryUsd}`)
    } else {
      parts.push(`usd-${filters.minSalaryUsd}-plus`)
    }
  }

  return parts
    .filter(Boolean)
    .join('-')
    .replace(/-+/g, '-')
}

/**
 * Translate filters into a Prisma "where" object.
 * We assume your Job model has:
 *  - roleSlug
 *  - baseRoleSlug
 *  - seniority
 *  - discipline
 *  - country
 *  - isRemote
 *  - companyId
 *  - salaryMin / salaryMax (BigInt, already annual USD)
 *  - isExpired
 *
 * If your schema differs, adjust this mapping.
 */
function buildJobWhereFromFilters(filters: SliceFilters): any {
  const where: any = {
    isExpired: false,
  }

  if (filters.roleSlug) where.roleSlug = filters.roleSlug
  if (filters.baseRoleSlug) where.baseRoleSlug = filters.baseRoleSlug
  if (filters.seniority) where.seniority = filters.seniority
  if (filters.discipline) where.discipline = filters.discipline

  if (filters.country) where.country = filters.country
  if (typeof filters.isRemote === 'boolean') where.isRemote = filters.isRemote

  if (filters.companyId) where.companyId = String(filters.companyId)

  if (typeof filters.minSalaryUsd === 'number') {
    const min = BigInt(Math.round(filters.minSalaryUsd))
    where.salaryMin = { gte: min }
  }

  if (typeof filters.maxSalaryUsd === 'number') {
    const max = BigInt(Math.round(filters.maxSalaryUsd))
    // crude band: either salaryMin <= max or salaryMax <= max
    where.OR = [
      { salaryMin: { lte: max } },
      { salaryMax: { lte: max } },
    ]
  }

  return where
}

/**
 * Core primitive:
 * - Builds slug
 * - Calculates jobCount from Job table
 * - Upserts into Slice table
 */
export async function upsertSlice(
  type: SliceType,
  filters: SliceFilters,
): Promise<SliceLike> {
  const slug = buildSliceSlug(type, filters)
  const where = buildJobWhereFromFilters(filters)

  const jobCount: number = await jobClient.count({
    where,
  } as any)

  const now = new Date()

  const slice = await sliceClient.upsert({
    where: { slug },
    update: {
      type,
      filtersJson: filters,
      jobCount,
      updatedAt: now,
    },
    create: {
      slug,
      type,
      filtersJson: filters,
      jobCount,
      createdAt: now,
      updatedAt: now,
    },
  } as any)

  return slice as SliceLike
}

/* ------------------------------------------------------------------ */
/* Convenience factories                                              */
/* ------------------------------------------------------------------ */

export async function upsertRoleSlice(options: {
  roleSlug?: string
  baseRoleSlug?: string
  seniority?: string
  discipline?: string
}) {
  return upsertSlice('role', {
    roleSlug: options.roleSlug,
    baseRoleSlug: options.baseRoleSlug,
    seniority: options.seniority,
    discipline: options.discipline,
  })
}

export async function upsertCountrySlice(country: string) {
  return upsertSlice('country', { country })
}

export async function upsertRemoteSlice() {
  return upsertSlice('remote', { isRemote: true })
}

export async function upsertRoleCountrySlice(options: {
  roleSlug?: string
  baseRoleSlug?: string
  country: string
  seniority?: string
}) {
  return upsertSlice('role_country', {
    roleSlug: options.roleSlug,
    baseRoleSlug: options.baseRoleSlug,
    country: options.country,
    seniority: options.seniority,
  })
}

export async function upsertRoleCountrySalarySlice(options: {
  roleSlug: string
  country: string
  minSalaryUsd: number
}) {
  return upsertSlice('role_country_salary', {
    roleSlug: options.roleSlug,
    country: options.country,
    minSalaryUsd: options.minSalaryUsd,
  })
}

export async function upsertRoleRemoteSalarySlice(options: {
  roleSlug: string
  minSalaryUsd: number
}) {
  return upsertSlice('role_remote_salary', {
    roleSlug: options.roleSlug,
    isRemote: true,
    minSalaryUsd: options.minSalaryUsd,
  })
}

export async function upsertCompanySlice(companyId: string | number) {
  return upsertSlice('company', { companyId })
}

export async function upsertCompanyRoleSlice(options: {
  companyId: string | number
  roleSlug?: string
  baseRoleSlug?: string
}) {
  return upsertSlice('company_role', {
    companyId: options.companyId,
    roleSlug: options.roleSlug,
    baseRoleSlug: options.baseRoleSlug,
  })
}

export async function upsertSalaryBandSlice(options: {
  label?: string // e.g. "100k-150k" (only used in slug indirectly)
  minSalaryUsd: number
  maxSalaryUsd?: number | null
}) {
  return upsertSlice('salary_band', {
    minSalaryUsd: options.minSalaryUsd,
    maxSalaryUsd: options.maxSalaryUsd ?? null,
  })
}

/* ------------------------------------------------------------------ */
/* Utils                                                              */
/* ------------------------------------------------------------------ */

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
