// lib/salary/roleGuide.ts
//
// The numbers behind /salary/[role], from the SAME filter as the job list on that page (so the guide and the list agree).
// Each job counts once, at the midpoint of its pay range. Headline figures use USD listings only, so they are in one
// currency; countries are shown in their own currency. Pure summary first (testable without a database), then the
// cached loader.

import { memoAsync, stableKey } from '../cache/memo'
import { prisma } from '../prisma'
import { buildWhere } from '../jobs/queryJobs'
import { looksLikeIdName } from '../companies/repairCompanyName'
import { summarizeByLevel, type LevelSalary } from '../jobs/listingSalaryStats'
import { percentile, salaryMidpoint, summarizeSalaries, type SalarySnapshot } from '../jobs/salarySnapshot'

export type GuideRow = {
  minAnnual: bigint | number | null
  maxAnnual: bigint | number | null
  currency: string | null
  countryCode: string | null
  experienceLevel: string | null
  companyName: string | null
  companySlug: string | null
  updatedAt: Date
}

export type CountrySalary = { countryCode: string; currency: string; count: number; median: number; p25: number; p75: number }
export type CompanySalary = { name: string; slug: string; count: number; median: number }

export type RoleSalaryGuide = {
  /** Every live listing matching the page, any currency. */
  listings: number
  /** USD listings with a usable pay figure (what the headline numbers are computed from). */
  usdCount: number
  /** Null when there are fewer than 20 USD listings: too few for a "typical" figure. */
  usd: (SalarySnapshot & { lowest: number; highest: number }) | null
  levels: LevelSalary[] | null
  countries: CountrySalary[]
  companies: CompanySalary[]
  /** The most recent time any listing in the sample was refreshed. */
  asOf: Date | null
}

const MIN_COUNTRY_LISTINGS = 5 // fewer and a median is one or two postings talking
const MIN_COMPANY_LISTINGS = 2
const MAX_COMPANIES = 8
const MAX_COUNTRIES = 8

const num = (v: bigint | number | null): number | null => (v == null ? null : Number(v))

function median(values: number[]): number {
  return percentile([...values].sort((a, b) => a - b), 0.5)
}

/** Pure: listings to the guide. */
export function summarizeRoleGuide(rows: GuideRow[]): RoleSalaryGuide {
  const priced = rows.flatMap((r) => {
    const mid = salaryMidpoint(r.minAnnual, r.maxAnnual)
    return mid === null || mid <= 0 ? [] : [{ r, mid, currency: (r.currency || 'USD').toUpperCase() }]
  })
  const usdRows = priced.filter((p) => p.currency === 'USD')

  const snapshot = summarizeSalaries(usdRows.map((p) => p.mid))
  const lows = usdRows.map((p) => num(p.r.minAnnual) ?? p.mid)
  const highs = usdRows.map((p) => num(p.r.maxAnnual) ?? p.mid)
  const usd = snapshot ? { ...snapshot, lowest: Math.min(...lows), highest: Math.max(...highs) } : null

  const levels = summarizeByLevel(usdRows.map((p) => ({ level: p.r.experienceLevel, value: p.mid })))

  const byCountry = new Map<string, { countryCode: string; currency: string; values: number[] }>()
  for (const p of priced) {
    if (!p.r.countryCode) continue
    const key = `${p.r.countryCode.toUpperCase()}|${p.currency}`
    const entry = byCountry.get(key) ?? { countryCode: p.r.countryCode.toUpperCase(), currency: p.currency, values: [] }
    entry.values.push(p.mid)
    byCountry.set(key, entry)
  }
  const countries = [...byCountry.values()]
    .filter((c) => c.values.length >= MIN_COUNTRY_LISTINGS)
    .map((c) => {
      const sorted = [...c.values].sort((a, b) => a - b)
      return { countryCode: c.countryCode, currency: c.currency, count: sorted.length, median: percentile(sorted, 0.5), p25: percentile(sorted, 0.25), p75: percentile(sorted, 0.75) }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_COUNTRIES)

  const byCompany = new Map<string, { name: string; slug: string; values: number[] }>()
  for (const p of usdRows) {
    const { companyName: name, companySlug: slug } = p.r
    if (!name || !slug || looksLikeIdName(name) || looksLikeIdName(slug)) continue // never publish an ATS id as an employer
    const entry = byCompany.get(slug) ?? { name, slug, values: [] }
    entry.values.push(p.mid)
    byCompany.set(slug, entry)
  }
  const companies = [...byCompany.values()]
    .filter((c) => c.values.length >= MIN_COMPANY_LISTINGS)
    .map((c) => ({ name: c.name, slug: c.slug, count: c.values.length, median: median(c.values) }))
    .sort((a, b) => b.count - a.count || b.median - a.median || a.name.localeCompare(b.name))
    .slice(0, MAX_COMPANIES)

  const asOf = rows.reduce<Date | null>((latest, r) => (!latest || r.updatedAt > latest ? r.updatedAt : latest), null)

  return { listings: rows.length, usdCount: usdRows.length, usd, levels, countries, companies, asOf }
}

export function loadRoleSalaryGuide(roleSlug: string, minAnnual: number): Promise<RoleSalaryGuide> {
  return memoAsync(stableKey('role-salary-guide', roleSlug, minAnnual), 10 * 60 * 1000, async () => {
    const jobs = await prisma.job.findMany({
      where: buildWhere({ roleSlugs: [roleSlug], minAnnual, page: 1, pageSize: 1 }),
      select: {
        minAnnual: true,
        maxAnnual: true,
        currency: true,
        countryCode: true,
        experienceLevel: true,
        updatedAt: true,
        companyRef: { select: { name: true, slug: true } },
      },
      take: 5000,
    })
    return summarizeRoleGuide(
      jobs.map((j) => ({
        minAnnual: j.minAnnual,
        maxAnnual: j.maxAnnual,
        currency: j.currency,
        countryCode: j.countryCode,
        experienceLevel: j.experienceLevel,
        companyName: j.companyRef?.name ?? null,
        companySlug: j.companyRef?.slug ?? null,
        updatedAt: j.updatedAt,
      })),
    )
  })
}
