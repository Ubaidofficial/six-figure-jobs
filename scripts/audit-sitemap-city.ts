import { prisma } from '../lib/prisma'
import { buildWhere } from '../lib/jobs/queryJobs'
import { CITY_TARGETS } from '../lib/seo/pseoTargets'

const MIN_INDEXABLE_JOBS = 3

type CountRow = { citySlug: string | null; _count: { _all: number } }

function rowsToMap(rows: CountRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.citySlug) continue
    map.set(String(row.citySlug).toLowerCase(), Number(row._count?._all ?? 0))
  }
  return map
}

async function main() {
  const baseWhere = buildWhere({} as any)
  const citySlugs = CITY_TARGETS.map((c) => c.slug)

  const [totals, withCountry] = await Promise.all([
    prisma.job.groupBy({
      by: ['citySlug'],
      where: { ...baseWhere, citySlug: { in: citySlugs } },
      _count: { _all: true },
    }),
    prisma.job.groupBy({
      by: ['citySlug'],
      where: {
        ...baseWhere,
        citySlug: { in: citySlugs },
        countryCode: { not: null },
      },
      _count: { _all: true },
    }),
  ])

  const totalMap = rowsToMap(totals as CountRow[])
  const withCountryMap = rowsToMap(withCountry as CountRow[])

  const rows = CITY_TARGETS.map((city) => {
    const slug = city.slug.toLowerCase()
    const total = totalMap.get(slug) ?? 0
    const withCountryCount = withCountryMap.get(slug) ?? 0
    const missingCountry = Math.max(0, total - withCountryCount)
    return {
      slug,
      label: city.label,
      total,
      withCountry: withCountryCount,
      missingCountry,
      indexable: total >= MIN_INDEXABLE_JOBS,
    }
  }).sort((a, b) => b.total - a.total)

  const indexable = rows.filter((r) => r.indexable)

  console.log(`[sitemap-city] MIN_INDEXABLE_JOBS=${MIN_INDEXABLE_JOBS}`)
  console.log(
    `[sitemap-city] indexable cities=${indexable.length}/${rows.length}`,
  )

  for (const row of rows) {
    const flag = row.indexable ? 'OK ' : '---'
    console.log(
      `[sitemap-city] ${flag} ${row.slug} (${row.label}) total=${row.total} withCountry=${row.withCountry} missingCountry=${row.missingCountry}`,
    )
  }
}

main().catch((err) => {
  console.error('[sitemap-city] error:', err)
  process.exitCode = 1
})
