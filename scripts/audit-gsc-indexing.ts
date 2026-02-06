// scripts/audit-gsc-indexing.ts
// DB-only audit for sitemap/indexing quality issues.

import { prisma } from '../lib/prisma'
import { buildGlobalExclusionsWhere, buildHighSalaryEligibilityWhere } from '../lib/jobs/queryJobs'
import { getSiteUrl } from '../lib/seo/site'
import { buildJobSlug } from '../lib/jobs/jobSlug'

function pct(n: number, d: number) {
  return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0.0%'
}

async function main() {
  const SITE_URL = getSiteUrl()
  const eligibleWhere = {
    isExpired: false,
    AND: [buildGlobalExclusionsWhere(), buildHighSalaryEligibilityWhere()],
  } as const

  const [totalJobs, activeJobs, eligibleJobs, enrichedActive, enrichedEligible] = await Promise.all([
    prisma.job.count({}),
    prisma.job.count({ where: { isExpired: false } }),
    prisma.job.count({ where: eligibleWhere }),
    prisma.job.count({ where: { isExpired: false, aiEnrichedAt: { not: null } } }),
    prisma.job.count({ where: { ...eligibleWhere, aiEnrichedAt: { not: null } } }),
  ])

  const [missingShortIdEligible, missingShortIdActive] = await Promise.all([
    prisma.job.count({ where: { ...eligibleWhere, shortId: null } }),
    prisma.job.count({ where: { isExpired: false, shortId: null } }),
  ])

  // Thin content: heuristic using raw HTML length (cheap).
  const thinRows = await prisma.$queryRaw<
    Array<{ bucket: string; count: bigint }>
  >`
    SELECT t.bucket, COUNT(*)::bigint as count
    FROM (
      SELECT
        CASE
          WHEN "descriptionHtml" IS NULL THEN 'null'
          WHEN length("descriptionHtml") < 100 THEN '<100'
          WHEN length("descriptionHtml") < 500 THEN '100-499'
          WHEN length("descriptionHtml") < 2000 THEN '500-1999'
          ELSE '2000+'
        END as bucket,
        CASE
          WHEN "descriptionHtml" IS NULL THEN 0
          WHEN length("descriptionHtml") < 100 THEN 1
          WHEN length("descriptionHtml") < 500 THEN 2
          WHEN length("descriptionHtml") < 2000 THEN 3
          ELSE 4
        END as sort
      FROM "Job"
      WHERE "isExpired" = false
    ) t
    GROUP BY t.bucket, t.sort
    ORDER BY t.sort;
  `

  // eslint-disable-next-line no-console
  console.log('=== GSC / Indexing DB Audit (DB-only) ===')
  // eslint-disable-next-line no-console
  console.log(`site=${SITE_URL}`)
  // eslint-disable-next-line no-console
  console.log(`totalJobs=${totalJobs}`)
  // eslint-disable-next-line no-console
  console.log(`activeJobs=${activeJobs}`)
  // eslint-disable-next-line no-console
  console.log(`eligibleJobs(highSalaryGate)=${eligibleJobs}`)
  // eslint-disable-next-line no-console
  console.log('')
  // eslint-disable-next-line no-console
  console.log(`enrichedActive=${enrichedActive} (${pct(enrichedActive, activeJobs)})`)
  // eslint-disable-next-line no-console
  console.log(`enrichedEligible=${enrichedEligible} (${pct(enrichedEligible, eligibleJobs)})`)
  // eslint-disable-next-line no-console
  console.log('')
  // eslint-disable-next-line no-console
  console.log(`missingShortIdActive=${missingShortIdActive} (${pct(missingShortIdActive, activeJobs)})`)
  // eslint-disable-next-line no-console
  console.log(`missingShortIdEligible=${missingShortIdEligible} (${pct(missingShortIdEligible, eligibleJobs)})`)
  // eslint-disable-next-line no-console
  console.log('')

  // eslint-disable-next-line no-console
  console.log('thinContent(activeJobs, by descriptionHtml length):')
  for (const row of thinRows) {
    // eslint-disable-next-line no-console
    console.log(`  ${row.bucket}: ${Number(row.count)}`)
  }

  // Sample a few missing-shortId eligible jobs; these are likely to 404 if sitemap uses v2.8 shortId slugs.
  if (missingShortIdEligible > 0) {
    const sample = await prisma.job.findMany({
      where: { ...eligibleWhere, shortId: null },
      orderBy: [{ createdAt: 'desc' }],
      take: 10,
      select: { id: true, title: true, externalId: true, source: true, createdAt: true },
    })

    // eslint-disable-next-line no-console
    console.log('\nSample eligible jobs missing shortId (likely sitemap/404 risk):')
    for (const j of sample) {
      const canonical = buildJobSlug({ id: j.id, title: j.title })
      // eslint-disable-next-line no-console
      console.log(
        `- id=${j.id} source=${j.source} createdAt=${j.createdAt.toISOString()} url=${SITE_URL}/job/${canonical}`,
      )
    }
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
