import { appendFile } from 'node:fs/promises'

import { buildFreshJobWhere, MAX_INDEXABLE_JOB_AGE_DAYS } from '../lib/jobs/freshness'
import {
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
  buildWhere,
} from '../lib/jobs/queryJobs'
import { buildIndexableJobStructureWhere } from '../lib/jobs/qualityGate'
import { prisma } from '../lib/prisma'

type PseoKpis = {
  totalJobs: number
  activeJobs: number
  highSalaryEligibleJobs: number
  browseEligibleJobs: number
  jobSitemapEligibleJobs: number
  newestActiveLastSeenAt: Date | null
}

function pct(numerator: number, denominator: number): string {
  return denominator > 0 ? `${((numerator / denominator) * 100).toFixed(1)}%` : '0.0%'
}

function inferPrimaryBottleneck(kpis: PseoKpis): string {
  if (kpis.activeJobs === 0) {
    return 'No active jobs are available. This points to ingestion or upstream DB population.'
  }

  if (kpis.highSalaryEligibleJobs === 0) {
    return 'Active jobs exist, but none pass the salary-validation/high-salary gate.'
  }

  if (kpis.browseEligibleJobs === 0) {
    return 'High-salary eligible jobs exist, but none remain fresh enough for browse pages.'
  }

  if (kpis.jobSitemapEligibleJobs === 0) {
    return 'Browse-eligible jobs exist, but none have enough structure/content for job sitemap pages.'
  }

  const freshnessRetention = kpis.browseEligibleJobs / Math.max(kpis.highSalaryEligibleJobs, 1)
  const structureRetention = kpis.jobSitemapEligibleJobs / Math.max(kpis.browseEligibleJobs, 1)

  if (freshnessRetention < 0.5) {
    return 'Freshness is the main drop-off between salary-eligible jobs and browse-eligible jobs.'
  }

  if (structureRetention < 0.5) {
    return 'Content/structure quality is the main drop-off between browse pages and job-detail sitemap pages.'
  }

  if (kpis.jobSitemapEligibleJobs < 10) {
    return 'The indexable pool exists, but it is thin enough to be operationally fragile.'
  }

  return 'The pSEO pool looks materially populated at the DB layer.'
}

async function appendStepSummary(lines: string[]) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return
  await appendFile(summaryPath, `${lines.join('\n')}\n`)
}

async function main() {
  const highSalaryEligibleWhere = {
    isExpired: false,
    AND: [buildGlobalExclusionsWhere(), buildHighSalaryEligibilityWhere()],
  } as const

  const browseEligibleWhere = buildWhere({})

  const jobSitemapEligibleWhere = {
    isExpired: false,
    AND: [
      buildGlobalExclusionsWhere(),
      buildHighSalaryEligibilityWhere(),
      buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS),
      buildIndexableJobStructureWhere(),
    ],
  } as const

  const [totalJobs, activeJobs, highSalaryEligibleJobs, browseEligibleJobs, jobSitemapEligibleJobs, newestActive] =
    await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { isExpired: false } }),
      prisma.job.count({ where: highSalaryEligibleWhere }),
      prisma.job.count({ where: browseEligibleWhere }),
      prisma.job.count({ where: jobSitemapEligibleWhere }),
      prisma.job.aggregate({
        where: { isExpired: false },
        _max: { lastSeenAt: true },
      }),
    ])

  const kpis: PseoKpis = {
    totalJobs,
    activeJobs,
    highSalaryEligibleJobs,
    browseEligibleJobs,
    jobSitemapEligibleJobs,
    newestActiveLastSeenAt: newestActive._max.lastSeenAt,
  }

  const bottleneck = inferPrimaryBottleneck(kpis)
  const freshnessRetention = pct(browseEligibleJobs, highSalaryEligibleJobs)
  const structureRetention = pct(jobSitemapEligibleJobs, browseEligibleJobs)

  console.log('=== pSEO KPI Report ===')
  console.log(`totalJobs=${totalJobs}`)
  console.log(`activeJobs=${activeJobs}`)
  console.log(`highSalaryEligibleJobs=${highSalaryEligibleJobs}`)
  console.log(`browseEligibleJobs=${browseEligibleJobs}`)
  console.log(`jobSitemapEligibleJobs=${jobSitemapEligibleJobs}`)
  console.log(`freshnessRetention=${freshnessRetention}`)
  console.log(`structureRetention=${structureRetention}`)
  console.log(`newestActiveLastSeenAt=${kpis.newestActiveLastSeenAt?.toISOString() ?? 'none'}`)
  console.log(`maxIndexableJobAgeDays=${MAX_INDEXABLE_JOB_AGE_DAYS}`)
  console.log(`primaryBottleneck=${bottleneck}`)

  await appendStepSummary([
    '## pSEO KPI Report',
    `- Total jobs: ${totalJobs}`,
    `- Active jobs: ${activeJobs}`,
    `- High-salary eligible jobs: ${highSalaryEligibleJobs}`,
    `- Browse-eligible jobs: ${browseEligibleJobs}`,
    `- Job-sitemap-eligible jobs: ${jobSitemapEligibleJobs}`,
    `- Freshness retention: ${freshnessRetention}`,
    `- Structure retention: ${structureRetention}`,
    `- Newest active lastSeenAt: ${kpis.newestActiveLastSeenAt?.toISOString() ?? 'none'}`,
    `- Max indexable job age days: ${MAX_INDEXABLE_JOB_AGE_DAYS}`,
    '',
    '### Interpretation',
    `- ${bottleneck}`,
    '',
  ])
}

main()
  .catch((error) => {
    console.error('[reportPseoKpis] error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
