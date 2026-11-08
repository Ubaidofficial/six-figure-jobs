// What the /jobs hub sidebar offers beyond role / country / work type: only choices the data has, counted under the
// visitor's other filters (a facet ignores its own filter, so its siblings stay visible and switchable).

import { prisma } from '../prisma'
import { COMPANY_SIZE_BUCKETS, SENIORITY_LEVELS, type HubExtraFacets } from './hubFilters'
import { buildWhere, type JobQueryInput } from './queryJobs'
import { REMOTE_HUB_CHIP_SLUGS, REMOTE_JOB_CLAUSE, countRemoteByRegion } from './remoteRegions'

const CITY_LIMIT = 30

// A facet must never take the page down: if its query fails the sidebar just leaves that section out.
async function orEmpty<T>(name: string, run: () => Promise<T[]>): Promise<T[]> {
  try {
    return await run()
  } catch (error) {
    console.error(`[jobs-hub] ${name} facet failed:`, error instanceof Error ? error.message : error)
    return []
  }
}

export async function loadHubExtraFacets(filters: JobQueryInput): Promise<HubExtraFacets> {
  const base: JobQueryInput = { ...filters, page: 1, pageSize: 1 }

  const [levels, cityRows, countryRows, companySizes] = await Promise.all([
    orEmpty('seniority', () =>
      prisma.job.groupBy({
        by: ['experienceLevel'],
        where: { ...buildWhere({ ...base, seniorityLevels: undefined }), experienceLevel: { not: null } },
        _count: { _all: true },
      }),
    ),
    orEmpty('city', () =>
      prisma.job.groupBy({
        by: ['citySlug', 'city'],
        where: { ...buildWhere({ ...base, citySlug: undefined }), citySlug: { not: null }, city: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { citySlug: 'desc' } },
        take: CITY_LIMIT * 2,
      }),
    ),
    // Remote jobs per country; a region is a set of countries (lib/jobs/remoteRegions.ts). The null group is the
    // "worldwide" bucket.
    orEmpty('remote region', () =>
      prisma.job.groupBy({
        by: ['countryCode'],
        where: { AND: [buildWhere({ ...base, remoteRegion: undefined }), REMOTE_JOB_CLAUSE] },
        _count: { _all: true },
      }),
    ),
    orEmpty('company size', () =>
      prisma.company.groupBy({
        by: ['sizeBucket'],
        where: { sizeBucket: { not: null }, jobs: { some: { isExpired: false } } },
        _count: { _all: true },
      }),
    ),
  ])

  const seniorityCounts = new Map(levels.map((r) => [String(r.experienceLevel), r._count._all]))
  const seniorities = SENIORITY_LEVELS.flatMap((l) => {
    const count = seniorityCounts.get(l.value) ?? 0
    return count > 0 ? [{ value: l.value, count }] : []
  })

  // The same slug can come back under spellings of the city name ("Zürich" / "Zurich"): one row per slug, biggest name.
  const cities = new Map<string, { value: string; label: string; count: number; best: number }>()
  for (const r of cityRows) {
    const slug = r.citySlug as string
    const n = r._count._all
    const prev = cities.get(slug)
    cities.set(slug, {
      value: slug,
      label: !prev || n > prev.best ? (r.city as string) : prev.label,
      count: (prev?.count ?? 0) + n,
      best: Math.max(prev?.best ?? 0, n),
    })
  }

  const regionCounts = countRemoteByRegion(
    countryRows.filter((r) => r.countryCode).map((r) => ({ code: String(r.countryCode), count: r._count._all })),
    countryRows.find((r) => !r.countryCode)?._count._all ?? 0,
  )
  const remoteRegions = REMOTE_HUB_CHIP_SLUGS.flatMap((slug) =>
    (regionCounts[slug] ?? 0) > 0 ? [{ value: slug, count: regionCounts[slug] }] : [],
  )

  const sizesWithJobs = new Set(companySizes.map((r) => r.sizeBucket))

  return {
    seniorities,
    cities: [...cities.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, CITY_LIMIT)
      .map(({ value, label, count }) => ({ value, label, count })),
    remoteRegions,
    companySizes: COMPANY_SIZE_BUCKETS.filter((b) => sizesWithJobs.has(b.value)).map((b) => b.value),
  }
}
