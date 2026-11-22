// lib/trends/marketTrends.ts
//
// The numbers on /trends, from the jobs we already list (no new tracking): open jobs and remote share overall and by area,
// how many were posted in the last 7 days against the 7 days before, the middle pay, the countries with the most jobs, and the
// employers hiring the most. The calculation is pure (buildMarketTrends) so it can be tested; the loaders read the database.
//
// These describe OUR listings: every job here states $100k+ pay (or the local equivalent), so a median is the middle of
// advertised six-figure ranges, not pay in general. Pay is read in US dollars only (amounts in other currencies are never
// converted); "new" follows lib/jobs/companyHiringStats.ts, the same rule as the company pages and /companies.
import { memoAsync } from '../cache/memo'
import { MIN_JOBS_FOR_MEDIAN, annualMidpoint, median, newnessOf } from '../jobs/companyHiringStats'
import { prisma } from '../prisma'
import { getPublicJobWhere } from '../jobs/publicStats'
import { JOB_CATEGORY_MAP } from '../seo/jobCategories'

/** The areas shown: disjoint groups of JOB_CATEGORY_MAP (its "devops" and "ML / AI" overlap engineering and data). */
export const TREND_AREAS = ['engineering', 'product', 'data', 'design', 'sales', 'marketing'] as const

export const TOP_COUNTRIES = 8
export const TOP_COMPANIES = 10
/** A week of apply clicks must reach this for a role to be shown, so a handful of clicks is not presented as demand. */
export const MIN_DEMAND_CLICKS = 10
export const MIN_DEMAND_ROLES = 3

export type TrendJobRow = {
  companyId: string | null
  roleSlug: string | null
  remote: boolean | null
  remoteMode: string | null
  countryCode: string | null
  currency: string | null
  minAnnual: bigint | number | null
  maxAnnual: bigint | number | null
  postedAt: Date | null
  createdAt: Date
}

export type TrendCell = {
  open: number
  remote: number
  newThisWeek: number
  newPreviousWeek: number
  /** Middle of the advertised US-dollar yearly pay; null with fewer than MIN_JOBS_FOR_MEDIAN jobs stating it. */
  medianUsd: number | null
  usdJobs: number
}

export type AreaTrend = TrendCell & { slug: string; label: string }
export type CountryTrend = { code: string; open: number; remote: number }
export type CompanyTrend = { companyId: string; open: number; newThisWeek: number }

export type MarketTrends = {
  overall: TrendCell
  areas: AreaTrend[]
  /** Every job that is in none of the areas. */
  other: TrendCell
  countries: CountryTrend[]
  companies: CompanyTrend[]
}

const AREA_OF_ROLE = new Map<string, string>()
for (const slug of TREND_AREAS) for (const role of JOB_CATEGORY_MAP[slug].roleSlugs) if (!AREA_OF_ROLE.has(role)) AREA_OF_ROLE.set(role, slug)

type Acc = { open: number; remote: number; newThisWeek: number; newPreviousWeek: number; usd: number[] }
const acc = (): Acc => ({ open: 0, remote: 0, newThisWeek: 0, newPreviousWeek: 0, usd: [] })

function cell(a: Acc): TrendCell {
  return {
    open: a.open,
    remote: a.remote,
    newThisWeek: a.newThisWeek,
    newPreviousWeek: a.newPreviousWeek,
    medianUsd: a.usd.length >= MIN_JOBS_FOR_MEDIAN ? Math.round(median(a.usd)) : null,
    usdJobs: a.usd.length,
  }
}

/** Pure: the public job rows to everything /trends shows. */
export function buildMarketTrends(rows: readonly TrendJobRow[], now: Date = new Date()): MarketTrends {
  const newness = newnessOf(rows, now)
  const overall = acc()
  const other = acc()
  const byArea = new Map<string, Acc>(TREND_AREAS.map((slug) => [slug, acc()]))
  const byCountry = new Map<string, { open: number; remote: number }>()
  const byCompany = new Map<string, { open: number; newThisWeek: number }>()

  rows.forEach((row, i) => {
    const isRemote = row.remote === true || row.remoteMode === 'remote'
    const pay = annualMidpoint(row)
    const area = byArea.get(AREA_OF_ROLE.get(row.roleSlug ?? '') ?? '') ?? other

    for (const a of [overall, area]) {
      a.open += 1
      if (isRemote) a.remote += 1
      if (newness[i] === 'this-week') a.newThisWeek += 1
      else if (newness[i] === 'previous-week') a.newPreviousWeek += 1
      if (pay?.currency === 'USD') a.usd.push(pay.midpoint)
    }

    if (row.countryCode) {
      const c = byCountry.get(row.countryCode) ?? { open: 0, remote: 0 }
      c.open += 1
      if (isRemote) c.remote += 1
      byCountry.set(row.countryCode, c)
    }
    if (row.companyId) {
      const c = byCompany.get(row.companyId) ?? { open: 0, newThisWeek: 0 }
      c.open += 1
      if (newness[i] === 'this-week') c.newThisWeek += 1
      byCompany.set(row.companyId, c)
    }
  })

  // Ties by key, so the order is the same on every render.
  const top = <T extends { open: number }>(m: Map<string, T>, n: number) =>
    [...m.entries()].sort((a, b) => b[1].open - a[1].open || a[0].localeCompare(b[0])).slice(0, n)

  return {
    overall: cell(overall),
    areas: TREND_AREAS.map((slug) => ({ slug, label: JOB_CATEGORY_MAP[slug].label, ...cell(byArea.get(slug)!) })),
    other: cell(other),
    countries: top(byCountry, TOP_COUNTRIES).map(([code, v]) => ({ code, ...v })),
    companies: top(byCompany, TOP_COMPANIES).map(([companyId, v]) => ({ companyId, ...v })),
  }
}

export type TrendCompany = CompanyTrend & { name: string; slug: string | null }
export type TrendsData = Omit<MarketTrends, 'companies'> & { companies: TrendCompany[] }

const TEN_MINUTES = 10 * 60 * 1000

/** The whole page's data, kept 10 minutes in the server process (a failed load is not kept; the caller handles the error). */
export function loadMarketTrends(): Promise<TrendsData> {
  return memoAsync('market-trends', TEN_MINUTES, async () => {
    const rows = await prisma.job.findMany({
      where: getPublicJobWhere(),
      select: {
        companyId: true,
        roleSlug: true,
        remote: true,
        remoteMode: true,
        countryCode: true,
        currency: true,
        minAnnual: true,
        maxAnnual: true,
        postedAt: true,
        createdAt: true,
      },
    })
    const trends = buildMarketTrends(rows)
    const companies = trends.companies.length
      ? await prisma.company.findMany({ where: { id: { in: trends.companies.map((c) => c.companyId) } }, select: { id: true, name: true, slug: true } })
      : []
    const byId = new Map(companies.map((c) => [c.id, c]))
    return {
      ...trends,
      companies: trends.companies.flatMap((c) => {
        const company = byId.get(c.companyId)
        return company?.name ? [{ ...c, name: company.name, slug: company.slug ?? null }] : []
      }),
    }
  })
}

export type PayWeek = { date: string; jobs: number; p25: number; median: number; p75: number; newJobs7d: number }

/** The overall US-dollar weekly snapshots (lib/history/marketSnapshot.ts), oldest first; empty when there are none or the table is missing. */
export async function loadPayWeeks(weeks = 8): Promise<PayWeek[]> {
  try {
    const rows = await prisma.marketSnapshot.findMany({
      where: { dimension: 'all', currency: 'USD' },
      orderBy: { snapshotDate: 'desc' },
      take: weeks,
    })
    return rows
      .map((r) => ({ date: r.snapshotDate.toISOString().slice(0, 10), jobs: r.jobs, p25: r.p25, median: r.median, p75: r.p75, newJobs7d: r.newJobs7d }))
      .reverse()
  } catch {
    return []
  }
}

export type RoleDemand = { roleSlug: string; clicks: number }

/** Pure: last week's apply clicks per role to the roles worth showing (none at all when too few reach the floor). */
export function demandRoles(rows: ReadonlyArray<{ key: string; clicks: number }>): RoleDemand[] {
  const roles = rows
    .filter((r) => r.key && r.key !== '(unknown)' && r.clicks >= MIN_DEMAND_CLICKS)
    .sort((a, b) => b.clicks - a.clicks || a.key.localeCompare(b.key))
    .slice(0, 5)
    .map((r) => ({ roleSlug: r.key, clicks: r.clicks }))
  return roles.length >= MIN_DEMAND_ROLES ? roles : []
}

/** Roles people applied to most in the latest rolled-up week (lib/history/clickRollup.ts: counts only); empty when too few. */
export async function loadRoleDemand(): Promise<{ weekStart: string; roles: RoleDemand[] } | null> {
  try {
    const latest = await prisma.applyClickWeekly.findFirst({ where: { dimension: 'role' }, orderBy: { weekStart: 'desc' }, select: { weekStart: true } })
    if (!latest) return null
    const rows = await prisma.applyClickWeekly.findMany({ where: { dimension: 'role', weekStart: latest.weekStart }, select: { key: true, clicks: true } })
    const roles = demandRoles(rows)
    return roles.length ? { weekStart: latest.weekStart.toISOString().slice(0, 10), roles } : null
  } catch {
    return null
  }
}
