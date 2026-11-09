// lib/jobs/siteCounts.ts
//
// Real counts of live jobs by country and by job type (remote / hybrid / on-site), for the homepage panel and the
// Remote hub chips. Counted from the database over the same public-job filter the listings use, and cached for
// SITE_COUNTS_TTL_MS (1 hour) so a busy page costs one set of count queries per hour, not one per visit.
// `computedAt` says when the numbers were taken.

import { memoAsync } from '../cache/memo'
import { prisma } from '../prisma'
import { buildWhere } from './queryJobs'
import { REMOTE_JOB_CLAUSE, remoteRegionWhere } from './remoteRegions'

export const SITE_COUNTS_TTL_MS = 60 * 60 * 1000

export type CountryCount = { code: string; count: number }

export type SiteCounts = {
  /** Every live public job. */
  total: number
  /** Jobs per country over all live jobs. */
  byCountry: CountryCount[]
  /** Jobs by how the work is done. The three need not add up to `total`: some jobs state none of them. */
  byWorkType: { remote: number; hybrid: number; onsite: number }
  /** Remote jobs per country, and remote jobs that can be done from anywhere (the "global" region). */
  remoteByCountry: CountryCount[]
  remoteWorldwide: number
  /** ISO time the counts were taken. */
  computedAt: string
}

export type CountryGroupRow = { countryCode: string | null; _count: { _all: number } }

/** Pure: groupBy rows to a sorted list of countries (rows without a country are returned separately). */
export function summarizeCountryGroups(rows: CountryGroupRow[]): { countries: CountryCount[]; withoutCountry: number } {
  const countries: CountryCount[] = []
  let withoutCountry = 0
  for (const row of rows) {
    const count = Number(row._count?._all ?? 0)
    if (!row.countryCode) withoutCountry += count
    else countries.push({ code: row.countryCode.toUpperCase(), count })
  }
  countries.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
  return { countries, withoutCountry }
}

/** Jobs in a set of countries, from per-country counts. */
export function countInCountries(byCountry: ReadonlyArray<CountryCount>, codes: ReadonlyArray<string>): number {
  const set = new Set(codes.map((c) => c.toUpperCase()))
  return byCountry.reduce((sum, c) => (set.has(c.code.toUpperCase()) ? sum + c.count : sum), 0)
}

export function loadSiteCounts(): Promise<SiteCounts> {
  return memoAsync('site-counts', SITE_COUNTS_TTL_MS, async () => {
    const base = buildWhere({ excludeInternships: true, page: 1, pageSize: 1 })
    const remoteWhere = { AND: [base, REMOTE_JOB_CLAUSE] }

    const [total, countryRows, remote, hybrid, onsite, remoteCountryRows, remoteWorldwide] = await Promise.all([
      prisma.job.count({ where: base }),
      prisma.job.groupBy({ by: ['countryCode'], where: base, _count: { _all: true } }),
      prisma.job.count({ where: remoteWhere }),
      prisma.job.count({ where: { AND: [base, { remoteMode: 'hybrid' }, { NOT: REMOTE_JOB_CLAUSE }] } }),
      prisma.job.count({ where: { AND: [base, { remoteMode: { in: ['onsite', 'on-site'] } }, { NOT: REMOTE_JOB_CLAUSE }] } }),
      prisma.job.groupBy({ by: ['countryCode'], where: remoteWhere, _count: { _all: true } }),
      prisma.job.count({ where: { AND: [base, remoteRegionWhere('global')] } }),
    ])

    const all = summarizeCountryGroups(countryRows)
    const rem = summarizeCountryGroups(remoteCountryRows)
    return {
      total,
      byCountry: all.countries,
      byWorkType: { remote, hybrid, onsite },
      remoteByCountry: rem.countries,
      remoteWorldwide,
      computedAt: new Date().toISOString(),
    }
  })
}
