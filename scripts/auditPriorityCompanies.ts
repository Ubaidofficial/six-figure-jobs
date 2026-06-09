// scripts/auditPriorityCompanies.ts
//
// Diagnose why 12 of the 20 priority companies are noindex on /company/[slug].
// Most likely causes:
//   - company row missing from DB
//   - atsProvider/atsUrl not configured (scraper has nothing to hit)
//   - scrapeStatus=failed (and the new cooldown is keeping it dormant)
//   - jobs all expired (lastScrapedAt is recent but jobCount=0)
//
// Run via:
//   railway run --service six-figure-jobs npx tsx scripts/auditPriorityCompanies.ts

import { prisma } from '../lib/prisma'
import { PRIORITY_COMPANY_SLUGS } from '../lib/seo/priorityCompanies'

type Row = {
  slug: string
  exists: boolean
  name: string | null
  atsProvider: string | null
  atsUrl: string | null
  scrapeStatus: string | null
  scrapeError: string | null
  lastScrapedAt: string | null
  storedJobCount: number | null
  liveJobs: number
  expiredJobs: number
  diagnosis: string
}

async function main() {
  const rows: Row[] = []

  for (const slug of PRIORITY_COMPANY_SLUGS) {
    const company = await prisma.company.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        atsProvider: true,
        atsUrl: true,
        scrapeStatus: true,
        scrapeError: true,
        lastScrapedAt: true,
        jobCount: true,
      },
    })

    if (!company) {
      rows.push({
        slug,
        exists: false,
        name: null,
        atsProvider: null,
        atsUrl: null,
        scrapeStatus: null,
        scrapeError: null,
        lastScrapedAt: null,
        storedJobCount: null,
        liveJobs: 0,
        expiredJobs: 0,
        diagnosis: 'company_row_missing',
      })
      continue
    }

    const [liveJobs, expiredJobs] = await Promise.all([
      prisma.job.count({
        where: { companyId: company.id, isExpired: false },
      }),
      prisma.job.count({
        where: { companyId: company.id, isExpired: true },
      }),
    ])

    let diagnosis = 'ok'
    if (!company.atsProvider || !company.atsUrl) {
      diagnosis = 'ats_not_configured'
    } else if (company.scrapeStatus === 'failed') {
      diagnosis = 'scrape_failed'
    } else if (liveJobs === 0 && expiredJobs > 0) {
      diagnosis = 'all_jobs_expired'
    } else if (liveJobs === 0) {
      diagnosis = 'no_jobs_ever'
    } else if (liveJobs < 5) {
      diagnosis = 'thin_below_5_jobs'
    }

    rows.push({
      slug,
      exists: true,
      name: company.name,
      atsProvider: company.atsProvider,
      atsUrl: company.atsUrl,
      scrapeStatus: company.scrapeStatus,
      scrapeError: company.scrapeError ? company.scrapeError.slice(0, 120) : null,
      lastScrapedAt: company.lastScrapedAt?.toISOString() ?? null,
      storedJobCount: company.jobCount,
      liveJobs,
      expiredJobs,
      diagnosis,
    })
  }

  // Bucket diagnoses
  const byDiagnosis = new Map<string, string[]>()
  for (const row of rows) {
    const list = byDiagnosis.get(row.diagnosis) ?? []
    list.push(row.slug)
    byDiagnosis.set(row.diagnosis, list)
  }

  console.log('\n=== Priority Company Audit ===\n')
  console.log(`Total priority companies: ${PRIORITY_COMPANY_SLUGS.length}`)
  for (const [diagnosis, slugs] of byDiagnosis) {
    console.log(`  ${diagnosis}: ${slugs.length}  [${slugs.join(', ')}]`)
  }

  console.log('\n=== Per-company detail ===\n')
  for (const row of rows) {
    const headline = `${row.slug.padEnd(20)} ${row.diagnosis.padEnd(22)} live=${String(row.liveJobs).padStart(3)} expired=${String(row.expiredJobs).padStart(4)}`
    console.log(headline)
    if (row.diagnosis !== 'ok') {
      const details = [
        row.exists ? null : 'NO COMPANY ROW',
        row.atsProvider ? `ats=${row.atsProvider}` : 'no atsProvider',
        row.atsUrl ? null : 'no atsUrl',
        row.scrapeStatus ? `status=${row.scrapeStatus}` : null,
        row.lastScrapedAt ? `lastScrapedAt=${row.lastScrapedAt}` : 'never scraped',
        row.scrapeError ? `error=${row.scrapeError}` : null,
      ]
        .filter(Boolean)
        .join('  |  ')
      console.log(`    ${details}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('audit failed:', err instanceof Error ? err.message : String(err))
  await prisma.$disconnect()
  process.exit(1)
})
