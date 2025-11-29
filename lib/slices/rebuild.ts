// lib/slices/rebuild.ts

import { prisma } from '../prisma'
import {
  upsertRoleSlice,
  upsertCountrySlice,
  upsertRemoteSlice,
  upsertRoleCountrySlice,
  upsertCompanySlice,
  upsertCompanyRoleSlice,
  upsertSalaryBandSlice,
} from './engine'

const jobClient = (prisma as any).job

export interface SliceRebuildSummary {
  roleSlices: number
  countrySlices: number
  remoteSlices: number
  roleCountrySlices: number
  companySlices: number
  companyRoleSlices: number
  salaryBandSlices: number
}

/**
 * Rebuild all slices based on current Job data.
 * Only uses non-expired jobs.
 */
export async function rebuildAllSlices(): Promise<SliceRebuildSummary> {
  const summary: SliceRebuildSummary = {
    roleSlices: 0,
    countrySlices: 0,
    remoteSlices: 0,
    roleCountrySlices: 0,
    companySlices: 0,
    companyRoleSlices: 0,
    salaryBandSlices: 0,
  }

  // ---------------------------------------------------------------------------
  // 1) Role slices (distinct roleSlug)
  // ---------------------------------------------------------------------------
  const roleRows = await jobClient.findMany({
    where: {
      isExpired: false,
      roleSlug: { not: null },
    },
    distinct: ['roleSlug'],
    select: {
      roleSlug: true,
      baseRoleSlug: true,
      seniority: true,
      discipline: true,
    },
  } as any)

  for (const r of roleRows) {
    await upsertRoleSlice({
      roleSlug: r.roleSlug,
      baseRoleSlug: r.baseRoleSlug ?? undefined,
      seniority: r.seniority ?? undefined,
      discipline: r.discipline ?? undefined,
    })
    summary.roleSlices++
  }

  // ---------------------------------------------------------------------------
  // 2) Country slices (distinct country)
  // ---------------------------------------------------------------------------
  const countryRows = await jobClient.findMany({
    where: {
      isExpired: false,
      country: { not: null },
    },
    distinct: ['country'],
    select: { country: true },
  } as any)

  for (const c of countryRows) {
    if (!c.country) continue
    await upsertCountrySlice(c.country)
    summary.countrySlices++
  }

  // ---------------------------------------------------------------------------
  // 3) Global remote slice
  // ---------------------------------------------------------------------------
  await upsertRemoteSlice()
  summary.remoteSlices = 1

  // ---------------------------------------------------------------------------
  // 4) Role + Country slices (distinct [roleSlug, country])
  // ---------------------------------------------------------------------------
  const roleCountryRows = await jobClient.findMany({
    where: {
      isExpired: false,
      roleSlug: { not: null },
      country: { not: null },
    },
    distinct: ['roleSlug', 'country'],
    select: {
      roleSlug: true,
      baseRoleSlug: true,
      seniority: true,
      country: true,
    },
  } as any)

  for (const rc of roleCountryRows) {
    if (!rc.roleSlug || !rc.country) continue
    await upsertRoleCountrySlice({
      roleSlug: rc.roleSlug,
      baseRoleSlug: rc.baseRoleSlug ?? undefined,
      country: rc.country,
      seniority: rc.seniority ?? undefined,
    })
    summary.roleCountrySlices++
  }

  // ---------------------------------------------------------------------------
  // 5) Company slices (distinct companyId)
  // ---------------------------------------------------------------------------
  const companyRows = await jobClient.findMany({
    where: {
      isExpired: false,
      companyId: { not: null },
    },
    distinct: ['companyId'],
    select: {
      companyId: true,
    },
  } as any)

  for (const row of companyRows) {
    if (!row.companyId) continue
    await upsertCompanySlice(row.companyId)
    summary.companySlices++
  }

  // ---------------------------------------------------------------------------
  // 6) Company + Role slices (distinct [companyId, roleSlug])
  // ---------------------------------------------------------------------------
  const companyRoleRows = await jobClient.findMany({
    where: {
      isExpired: false,
      companyId: { not: null },
      roleSlug: { not: null },
    },
    distinct: ['companyId', 'roleSlug'],
    select: {
      companyId: true,
      roleSlug: true,
      baseRoleSlug: true,
    },
  } as any)

  for (const cr of companyRoleRows) {
    if (!cr.companyId || !cr.roleSlug) continue
    await upsertCompanyRoleSlice({
      companyId: cr.companyId,
      roleSlug: cr.roleSlug,
      baseRoleSlug: cr.baseRoleSlug ?? undefined,
    })
    summary.companyRoleSlices++
  }

  // ---------------------------------------------------------------------------
  // 7) Salary band slices (static bands in USD)
  //    Assumes salaryMin is annual USD (or at least comparable).
  // ---------------------------------------------------------------------------
  const salaryBands = [
    { min: 100_000, max: 150_000 },
    { min: 150_000, max: 200_000 },
    { min: 200_000, max: null },
  ]

  for (const band of salaryBands) {
    await upsertSalaryBandSlice({
      minSalaryUsd: band.min,
      maxSalaryUsd: band.max,
    })
    summary.salaryBandSlices++
  }

  return summary
}
