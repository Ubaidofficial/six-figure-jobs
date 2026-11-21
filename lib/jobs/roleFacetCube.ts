// lib/jobs/roleFacetCube.ts
//
// The numbers around a role page's job list (jobs in total, pay, countries, work types, regions, seniority, company sizes, top
// employers, top cities) came from about a dozen separate queries per role, each a full scan of the job table with the base listing
// filter. A cold server runs them for every role page a visitor or crawler opens (measured 2026-11-21 with SLOW_QUERY_LOG_MS=500:
// 0.5-1.3 s each when the database is quiet, 2-4 s when many run at once; a cold role page ran 27 of them, 12 after PR #208).
//
// This reads them from SIX grouped scans of the whole table instead, kept for 10 minutes (served stale while they refresh, one
// build shared by every page), and adds them up per role in code. A role page's filter is "roleSlug is the slug or contains it",
// so a row counts for every role whose slug it contains. Only the plain page (no filter chosen) uses it: with a filter chosen the
// separate queries run as before. If the build fails the separate queries run, so a database error never shows as zeros.
import { memoAsync } from '../cache/memo'
import { prisma } from '../prisma'
import { COMPANY_SIZE_BUCKETS } from './levelSizeFacets'
import { regionCountsFromRows, workTypesFromRows, type ModeRow, type NoCountryRow, type RegionRef } from './listingFacets'
import { buildWhere, type JobQueryInput } from './queryJobs'
import { LISTING_REMOTE_REGIONS, REMOTE_JOB_CLAUSE } from './remoteRegions'

export const ROLE_CUBE_TTL_MS = 10 * 60 * 1000
const TOP_COUNTRIES = 40
const TOP_COMPANIES = 24
const TOP_CITIES = 6

type WithRole<T> = T & { roleSlug: string | null }
type Pay = { sumMax: number; nMax: number; sumMin: number; nMin: number }

export type RoleCube = {
  modeRows: Array<WithRole<ModeRow>>
  noCountryRows: Array<WithRole<NoCountryRow>>
  levelRows: Array<{ roleSlug: string | null; experienceLevel: string; count: number }>
  companyRows: Array<{ roleSlug: string | null; companyId: string; count: number }>
  payRows: Array<WithRole<Pay>>
  cityRows: Array<WithRole<Pay & { citySlug: string; city: string | null; countryCode: string | null; count: number }>>
  /** companyId -> size bucket, for the companies that have one. */
  sizeOf: Map<string, string>
}

/** What a role page's queries returned, in the same shapes (so the page code that reads them is unchanged). */
export type RoleFacets = {
  total: number
  countryRows: Array<{ countryCode: string; _count: { _all: number } }>
  workTypes: { remote: number; hybrid: number; onsite: number }
  regions: number[]
  seniority: Record<string, number>
  companySizes: Record<string, number>
  topCompanyGroups: Array<{ companyId: string; _count: { _all: number } }>
  avgUsd: { _avg: { maxAnnual: number | null; minAnnual: number | null } }
  topCityRows: Array<{ citySlug: string; city: string | null; countryCode: string | null; _count: { _all: number }; _avg: { maxAnnual: number | null; minAnnual: number | null } }>
}

/** Does a job stored under `rowRole` belong to the role page for `slug`? (buildWhere: roleSlug = slug OR roleSlug contains slug.) */
export function roleMatches(rowRole: string | null, slug: string): boolean {
  return rowRole != null && rowRole.includes(slug)
}

/** True when the role page has no filter chosen, so the whole-role numbers are the numbers it needs. */
export function isPlainRoleInput(input: JobQueryInput): boolean {
  return (
    !input.countryCode &&
    !input.remoteMode &&
    !input.remoteRegion &&
    !input.seniorityLevels?.length &&
    !input.companySizeBuckets?.length &&
    !input.skillSlugs?.length &&
    input.minAnnual == null &&
    input.currency == null
  )
}

const num = (v: unknown): number => (v == null ? 0 : Number(v))
const avgOf = (sum: number, n: number): number | null => (n > 0 ? sum / n : null)

/** Descending, with missing values first: how Postgres orders `ORDER BY avg DESC`. */
const descNullsFirst = (a: number | null, b: number | null): number => {
  if (a === b) return 0
  if (a === null) return -1
  if (b === null) return 1
  return b - a
}

export function facetsForRole(cube: RoleCube, slug: string, regions: readonly RegionRef[]): RoleFacets {
  const modeRows = cube.modeRows.filter((r) => roleMatches(r.roleSlug, slug))
  const noCountry = cube.noCountryRows.filter((r) => roleMatches(r.roleSlug, slug))

  const total = modeRows.reduce((s, r) => s + r.count, 0)

  const byCountry = new Map<string, number>()
  for (const r of modeRows) if (r.countryCode) byCountry.set(r.countryCode, (byCountry.get(r.countryCode) ?? 0) + r.count)
  const countryRows = [...byCountry]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_COUNTRIES)
    .map(([countryCode, count]) => ({ countryCode, _count: { _all: count } }))

  const seniority: Record<string, number> = {}
  for (const r of cube.levelRows) if (roleMatches(r.roleSlug, slug)) seniority[r.experienceLevel] = (seniority[r.experienceLevel] ?? 0) + r.count

  const byCompany = new Map<string, number>()
  for (const r of cube.companyRows) if (roleMatches(r.roleSlug, slug)) byCompany.set(r.companyId, (byCompany.get(r.companyId) ?? 0) + r.count)
  const companySizes: Record<string, number> = Object.fromEntries(COMPANY_SIZE_BUCKETS.map((b) => [b, 0]))
  for (const [companyId, count] of byCompany) {
    const bucket = cube.sizeOf.get(companyId)
    if (bucket && bucket in companySizes) companySizes[bucket] += count
  }
  const topCompanyGroups = [...byCompany]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_COMPANIES)
    .map(([companyId, count]) => ({ companyId, _count: { _all: count } }))

  const pay = cube.payRows.filter((r) => roleMatches(r.roleSlug, slug)).reduce((p, r) => ({ sumMax: p.sumMax + r.sumMax, nMax: p.nMax + r.nMax, sumMin: p.sumMin + r.sumMin, nMin: p.nMin + r.nMin }), { sumMax: 0, nMax: 0, sumMin: 0, nMin: 0 })

  const cities = new Map<string, Pay & { citySlug: string; city: string | null; countryCode: string | null; count: number }>()
  for (const r of cube.cityRows) {
    if (!roleMatches(r.roleSlug, slug)) continue
    const key = `${r.citySlug}\u0000${r.city ?? ''}\u0000${r.countryCode ?? ''}`
    const c = cities.get(key) ?? { citySlug: r.citySlug, city: r.city, countryCode: r.countryCode, count: 0, sumMax: 0, nMax: 0, sumMin: 0, nMin: 0 }
    c.count += r.count
    c.sumMax += r.sumMax
    c.nMax += r.nMax
    c.sumMin += r.sumMin
    c.nMin += r.nMin
    cities.set(key, c)
  }
  const topCityRows = [...cities.entries()]
    .map(([key, c]) => ({ key, c, max: avgOf(c.sumMax, c.nMax), min: avgOf(c.sumMin, c.nMin) }))
    .sort((a, b) => descNullsFirst(a.max, b.max) || descNullsFirst(a.min, b.min) || a.key.localeCompare(b.key))
    .slice(0, TOP_CITIES)
    .map(({ c, max, min }) => ({ citySlug: c.citySlug, city: c.city, countryCode: c.countryCode, _count: { _all: c.count }, _avg: { maxAnnual: max, minAnnual: min } }))

  return {
    total,
    countryRows,
    workTypes: workTypesFromRows(modeRows),
    regions: regionCountsFromRows(regions, modeRows, noCountry),
    seniority,
    companySizes,
    topCompanyGroups,
    avgUsd: { _avg: { maxAnnual: avgOf(pay.sumMax, pay.nMax), minAnnual: avgOf(pay.sumMin, pay.nMin) } },
    topCityRows,
  }
}

async function buildCube(): Promise<RoleCube> {
  const base = buildWhere({ page: 1, pageSize: 1 })
  // The pay and city numbers of the role page replace the freshness rule with their own `OR` (they spread buildWhere and set OR),
  // so they are computed from the same replaced filter here.
  const payWhere = { ...base, currency: 'USD', OR: [{ maxAnnual: { not: null } }, { minAnnual: { not: null } }] }
  const [modes, noCountry, levels, companies, pays, cities, sized] = await Promise.all([
    prisma.job.groupBy({ by: ['roleSlug', 'remoteMode', 'remote', 'countryCode', 'remoteRegion'], where: base, _count: { _all: true } }),
    prisma.job.groupBy({ by: ['roleSlug', 'remoteRegion', 'locationRaw'], where: { AND: [base, REMOTE_JOB_CLAUSE, { countryCode: null }] }, _count: { _all: true } }),
    prisma.job.groupBy({ by: ['roleSlug', 'experienceLevel'], where: { AND: [base, { experienceLevel: { not: null } }] }, _count: { _all: true } }),
    prisma.job.groupBy({ by: ['roleSlug', 'companyId'], where: { AND: [base, { companyId: { not: null } }] }, _count: { _all: true } }),
    prisma.job.groupBy({ by: ['roleSlug'], where: payWhere, _sum: { maxAnnual: true, minAnnual: true }, _count: { maxAnnual: true, minAnnual: true } }),
    prisma.job.groupBy({
      by: ['roleSlug', 'citySlug', 'city', 'countryCode'],
      where: { ...payWhere, citySlug: { not: null } },
      _count: { _all: true, maxAnnual: true, minAnnual: true },
      _sum: { maxAnnual: true, minAnnual: true },
    }),
    prisma.company.findMany({ where: { sizeBucket: { in: [...COMPANY_SIZE_BUCKETS] } }, select: { id: true, sizeBucket: true } }),
  ])
  return {
    modeRows: modes.map((g) => ({ roleSlug: g.roleSlug, remoteMode: g.remoteMode, remote: g.remote, countryCode: g.countryCode, remoteRegion: g.remoteRegion, count: g._count._all })),
    noCountryRows: noCountry.map((g) => ({ roleSlug: g.roleSlug, remoteRegion: g.remoteRegion, locationRaw: g.locationRaw, count: g._count._all })),
    levelRows: levels.filter((g) => g.experienceLevel).map((g) => ({ roleSlug: g.roleSlug, experienceLevel: g.experienceLevel as string, count: g._count._all })),
    companyRows: companies.filter((g) => g.companyId).map((g) => ({ roleSlug: g.roleSlug, companyId: g.companyId as string, count: g._count._all })),
    payRows: pays.map((g) => ({ roleSlug: g.roleSlug, sumMax: num(g._sum.maxAnnual), nMax: num(g._count.maxAnnual), sumMin: num(g._sum.minAnnual), nMin: num(g._count.minAnnual) })),
    cityRows: cities
      .filter((g) => g.citySlug)
      .map((g) => ({ roleSlug: g.roleSlug, citySlug: g.citySlug as string, city: g.city, countryCode: g.countryCode, count: g._count._all, sumMax: num(g._sum.maxAnnual), nMax: num(g._count.maxAnnual), sumMin: num(g._sum.minAnnual), nMin: num(g._count.minAnnual) })),
    sizeOf: new Map(sized.filter((c) => c.sizeBucket).map((c) => [c.id, c.sizeBucket as string])),
  }
}

/** The whole-table grouped counts, built once for every role page (10 minutes, stale while it refreshes). */
export function loadRoleFacetCube(): Promise<RoleCube> {
  return memoAsync('role-facet-cube', ROLE_CUBE_TTL_MS, buildCube)
}

/**
 * The numbers of one plain role page from the cube, or null when the cube cannot be built (the caller then runs its own queries).
 * The page and its metadata both ask, so the sums for one role are kept for a minute.
 */
export async function loadRoleFacets(slug: string): Promise<RoleFacets | null> {
  try {
    return await memoAsync(`role-facets-from-cube:${slug}`, 60_000, async () => facetsForRole(await loadRoleFacetCube(), slug, LISTING_REMOTE_REGIONS))
  } catch (error) {
    console.error('[roleFacetCube] build failed, running the separate queries:', error instanceof Error ? error.message.split('\n')[0] : error)
    return null
  }
}
