// scripts/auditCompanyMetrics.ts
/**
 * Phase 4 – Company Metrics Audit / Repair
 *
 * Goals:
 *  - Ensure Company.jobCount matches the actual number of active jobs
 *  - Surface $100k+ job counts per company from the Job table
 *  - Prepare for trust metrics on company pages:
 *      • "Open roles (career site)" → Company.totalJobCount  (scraped elsewhere)
 *      • "$100k+ roles on Remote100k" → derived from Job table here
 *
 * Usage:
 *
 *  Audit only (no writes):
 *    npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/auditCompanyMetrics.ts --mode=audit --dry-run --limit=100
 *
 *  Full audit (no writes, all companies):
 *    npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/auditCompanyMetrics.ts --mode=audit --dry-run
 *
 *  Repair cached jobCount (writes to DB – be careful):
 *    npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/auditCompanyMetrics.ts --mode=repair
 */

import { PrismaClient, Prisma, Company } from '@prisma/client'

const prisma = new PrismaClient()

type Mode = 'audit' | 'repair'

interface CliOptions {
  mode: Mode
  dryRun: boolean
  limit: number | null
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)

  const getArg = (name: string): string | null => {
    const idx = args.indexOf(name)
    if (idx === -1) return null
    return args[idx + 1] ?? null
  }

  const modeArg = (getArg('--mode') || 'audit').toLowerCase()
  const mode: Mode = modeArg === 'repair' ? 'repair' : 'audit'

  const dryRun = args.includes('--dry-run')

  const limitArg = getArg('--limit')
  const limit = limitArg ? Number(limitArg) || null : null

  return { mode, dryRun, limit }
}

async function main() {
  const { mode, dryRun, limit } = parseCliArgs()

  console.log('🏢 Phase 4 – Company Metrics Audit / Repair')
  console.log(`   Mode    : ${mode}`)
  console.log(`   Dry run : ${dryRun ? 'YES (no writes)' : 'no'}`)
  console.log(`   Limit   : ${limit ?? 'none'}`)
  console.log('')

  // We care about all companies that either have jobs or ATS metadata
  const whereClause: Prisma.CompanyWhereInput = {
    OR: [
      { jobs: { some: {} } },
      { atsProvider: { not: null } },
      { atsUrl: { not: null } },
      { totalJobCount: { not: null } },
    ],
  }

  const companies = await prisma.company.findMany({
    where: whereClause,
    take: limit ?? undefined,
    orderBy: { name: 'asc' },
  })

  console.log(`🔍 Loaded ${companies.length} companies for audit`)
  if (companies.length === 0) {
    console.log('✅ Nothing to do, exiting.')
    await prisma.$disconnect()
    return
  }

  let scanned = 0
  let withJobs = 0
  let mismatchJobCount = 0
  let updatedJobCount = 0

  // global aggregates
  let totalDbActiveJobs = 0
  let totalDbHighSalaryJobs = 0

  const updates: Array<Promise<Company>> = []

  for (const company of companies) {
    scanned++

    // Count active jobs for this company
    // We treat "isExpired = false" as active.
    const [activeJobsCount, highSalaryJobsCount] = await Promise.all([
      prisma.job.count({
        where: {
          companyId: company.id,
          isExpired: false,
        },
      }),
      prisma.job.count({
        where: {
          companyId: company.id,
          isExpired: false,
          isHundredKLocal: true,
        },
      }),
    ])

    if (activeJobsCount > 0) {
      withJobs++
    }

    totalDbActiveJobs += activeJobsCount
    totalDbHighSalaryJobs += highSalaryJobsCount

    const cachedJobCount = company.jobCount ?? 0

    const hasMismatch = cachedJobCount !== activeJobsCount

    if (hasMismatch) {
      mismatchJobCount++
    }

    // For company pages: we will later use:
    //   - company.totalJobCount   → scraped careers site count (external)
    //   - highSalaryJobsCount     → "$100k+ roles on Remote100k"
    // For now this script does NOT modify totalJobCount (that’s the scrapers’ job).

    if (mode === 'audit') {
      if (hasMismatch && mismatchJobCount <= 20) {
        console.log(
          `• [AUDIT] ${company.name} (${company.slug}) – ` +
            `cached jobCount=${cachedJobCount}, active in DB=${activeJobsCount}, ` +
            `$100k+ active=${highSalaryJobsCount}, ` +
            `totalJobCount (careers)=${company.totalJobCount ?? 'null'}`
        )
      }
      continue
    }

    // Repair mode: align company.jobCount to actual active jobs
    const data: Partial<Company> = {}

    if (hasMismatch) {
      data.jobCount = activeJobsCount
    }

    const hasAnyUpdate = Object.keys(data).length > 0
    if (!hasAnyUpdate) continue

    updatedJobCount++

    if (dryRun) {
      if (updatedJobCount <= 20) {
        console.log(
          `• [DRY RUN] ${company.name} (${company.slug}) – ` +
            `jobCount: ${cachedJobCount} → ${data.jobCount}`
        )
      }
      continue
    }

    updates.push(
      prisma.company.update({
        where: { id: company.id },
        data,
      })
    )
  }

  if (mode === 'repair' && !dryRun && updates.length > 0) {
    console.log(`💾 Applying ${updates.length} company metric updates...`)
    await Promise.all(updates)
  }

  console.log('')
  console.log('📊 Company Metrics Summary')
  console.log('--------------------------')
  console.log(`Companies scanned                     : ${scanned}`)
  console.log(`Companies with ≥1 active job in DB    : ${withJobs}`)
  console.log(`Companies with jobCount mismatch      : ${mismatchJobCount}`)
  if (mode === 'repair') {
    console.log(
      `Companies ${dryRun ? 'that WOULD be ' : ''}updated jobCount : ${updatedJobCount}`
    )
  }
  console.log('')
  console.log('Global aggregates from Job table')
  console.log('--------------------------------')
  console.log(`Total active jobs (isExpired=false)   : ${totalDbActiveJobs}`)
  console.log(`Total active $100k+ jobs (DB)         : ${totalDbHighSalaryJobs}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('💥 Error in auditCompanyMetrics.ts')
  console.error(err)
  prisma
    .$disconnect()
    .catch(() => {
      // ignore
    })
    .finally(() => {
      process.exit(1)
    })
})
