// scripts/diagnoseCompanyDisplayGate.ts
//
// Why does /company/<slug> show "1 Open Positions" when the DB has 99 jobs?
// This script counts a company's jobs at each filter stage that buildWhere()
// applies, so we can see exactly which gate is dropping them.
//
// Run via:
//   railway run --service six-figure-jobs npx tsx scripts/diagnoseCompanyDisplayGate.ts <slug>
//
// Defaults to "stripe" if no slug is passed.

import { prisma } from '../lib/prisma'
import {
  buildWhere,
  buildHighSalaryEligibilityWhere,
  buildGlobalExclusionsWhere,
} from '../lib/jobs/queryJobs'
import { buildFreshJobWhere } from '../lib/jobs/freshness'
import { MAX_DISPLAY_AGE_DAYS } from '../lib/ingest/jobAgeFilter'

async function main() {
  const slug = (process.argv[2] || 'stripe').toLowerCase().trim()
  console.log(`\n=== Diagnosing /company/${slug} display gate ===\n`)

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, jobCount: true, scrapeStatus: true },
  })
  if (!company) {
    console.log(`Company not found: ${slug}`)
    return
  }
  console.log(`Company: ${company.name} (id=${company.id})`)
  console.log(`Stored jobCount=${company.jobCount} scrapeStatus=${company.scrapeStatus}\n`)

  // Each row is one cumulative filter stage. The funnel shows where jobs drop.
  const stages: { label: string; where: any }[] = [
    { label: '1. All jobs (any status)', where: { companyId: company.id } },
    {
      label: '2. Not expired',
      where: { companyId: company.id, isExpired: false },
    },
    {
      label: '3. + Fresh (lastSeenAt or postedAt within MAX_DISPLAY_AGE_DAYS)',
      where: {
        companyId: company.id,
        isExpired: false,
        ...buildFreshJobWhere(MAX_DISPLAY_AGE_DAYS),
      },
    },
    {
      label: '4. + salaryValidated=true',
      where: {
        companyId: company.id,
        isExpired: false,
        ...buildFreshJobWhere(MAX_DISPLAY_AGE_DAYS),
        salaryValidated: true,
      },
    },
    {
      label: '5. + High-salary eligibility (salaryConfidence>=80, threshold met)',
      where: {
        companyId: company.id,
        isExpired: false,
        ...buildFreshJobWhere(MAX_DISPLAY_AGE_DAYS),
        AND: [buildHighSalaryEligibilityWhere()],
      },
    },
    {
      label: '6. + Global exclusions (no intern/junior/entry/part-time/contract)',
      where: {
        companyId: company.id,
        isExpired: false,
        ...buildFreshJobWhere(MAX_DISPLAY_AGE_DAYS),
        AND: [buildHighSalaryEligibilityWhere(), buildGlobalExclusionsWhere()],
      },
    },
    {
      label: '7. Full company-page where (buildWhere companySlug:slug)',
      where: buildWhere({ companySlug: slug }),
    },
  ]

  for (const stage of stages) {
    const n = await prisma.job.count({ where: stage.where as any })
    console.log(`${stage.label.padEnd(70)} ${String(n).padStart(5)}`)
  }

  // Now break down the surviving-vs-dropped jobs at the salary-eligibility
  // step — usually the biggest drop. We want to see the raw values.
  console.log('\n=== Salary/quality field distribution across all live jobs ===\n')
  const liveJobs = await prisma.job.findMany({
    where: { companyId: company.id, isExpired: false },
    select: {
      title: true,
      salaryValidated: true,
      salaryConfidence: true,
      currency: true,
      minAnnual: true,
      maxAnnual: true,
      lastSeenAt: true,
      postedAt: true,
    },
    take: 200,
  })

  const buckets = {
    salaryValidatedTrue: 0,
    salaryValidatedFalse: 0,
    salaryValidatedNull: 0,
    confidenceGte80: 0,
    confidence_under_80_but_set: 0,
    confidenceNull: 0,
    currencyUSD: 0,
    currencyOther: 0,
    currencyNull: 0,
    hasMinOrMax: 0,
    noMinNoMax: 0,
  }
  for (const j of liveJobs) {
    if (j.salaryValidated === true) buckets.salaryValidatedTrue++
    else if (j.salaryValidated === false) buckets.salaryValidatedFalse++
    else buckets.salaryValidatedNull++

    const conf = j.salaryConfidence == null ? null : Number(j.salaryConfidence)
    if (conf == null) buckets.confidenceNull++
    else if (conf >= 80) buckets.confidenceGte80++
    else buckets.confidence_under_80_but_set++

    if (!j.currency) buckets.currencyNull++
    else if (j.currency.toUpperCase() === 'USD') buckets.currencyUSD++
    else buckets.currencyOther++

    if (j.minAnnual != null || j.maxAnnual != null) buckets.hasMinOrMax++
    else buckets.noMinNoMax++
  }

  for (const [key, val] of Object.entries(buckets)) {
    console.log(`  ${key.padEnd(30)} ${String(val).padStart(5)}`)
  }

  console.log('\n=== Sample of jobs (first 5 from live set) ===\n')
  for (const j of liveJobs.slice(0, 5)) {
    console.log(
      `  "${j.title.slice(0, 60)}" — validated=${j.salaryValidated} conf=${j.salaryConfidence} cur=${j.currency} min=${j.minAnnual} max=${j.maxAnnual}`,
    )
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('failed:', err instanceof Error ? err.message : String(err))
  await prisma.$disconnect()
  process.exit(1)
})
