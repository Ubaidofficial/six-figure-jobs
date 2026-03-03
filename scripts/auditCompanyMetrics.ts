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

import { format as __format } from 'node:util'
import { PrismaClient, Prisma, Company } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


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

  __slog('🏢 Phase 4 – Company Metrics Audit / Repair')
  __slog(`   Mode    : ${mode}`)
  __slog(`   Dry run : ${dryRun ? 'YES (no writes)' : 'no'}`)
  __slog(`   Limit   : ${limit ?? 'none'}`)
  __slog('')

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

  __slog(`🔍 Loaded ${companies.length} companies for audit`)
  if (companies.length === 0) {
    __slog('✅ Nothing to do, exiting.')
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
        __slog(
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
        __slog(
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
    __slog(`💾 Applying ${updates.length} company metric updates...`)
    await Promise.all(updates)
  }

  __slog('')
  __slog('📊 Company Metrics Summary')
  __slog('--------------------------')
  __slog(`Companies scanned                     : ${scanned}`)
  __slog(`Companies with ≥1 active job in DB    : ${withJobs}`)
  __slog(`Companies with jobCount mismatch      : ${mismatchJobCount}`)
  if (mode === 'repair') {
    __slog(
      `Companies ${dryRun ? 'that WOULD be ' : ''}updated jobCount : ${updatedJobCount}`
    )
  }
  __slog('')
  __slog('Global aggregates from Job table')
  __slog('--------------------------------')
  __slog(`Total active jobs (isExpired=false)   : ${totalDbActiveJobs}`)
  __slog(`Total active $100k+ jobs (DB)         : ${totalDbHighSalaryJobs}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  __serr('💥 Error in auditCompanyMetrics.ts')
  __serr(err)
  prisma
    .$disconnect()
    .catch(() => {
      // ignore
    })
    .finally(() => {
      process.exit(1)
    })
})
