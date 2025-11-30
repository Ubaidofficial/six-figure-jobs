// scripts/repairCurrencyAndSalary.ts
/**
 * Phase 4 – Currency & Salary Repair / Audit
 *
 * Usage examples:
 *
 *  Audit only (no writes):
 *    npx tsx scripts/repairCurrencyAndSalary.ts --mode=audit --dry-run --limit=500
 *
 *  Dry-run repair (log what WOULD change):
 *    npx tsx scripts/repairCurrencyAndSalary.ts --mode=repair --dry-run --limit=500
 *
 *  Full repair (be careful, this writes to DB):
 *    npx tsx scripts/repairCurrencyAndSalary.ts --mode=repair
 */

import { PrismaClient, Prisma, Job } from '@prisma/client'
import {
  normalizeJobSalaryFields,
  checkCurrencyLocationMismatch,
  COUNTRY_TO_CURRENCY,
} from '../lib/normalizers/salary'

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

  const modeArg = (getArg('--mode') || 'repair').toLowerCase()
  const mode: Mode = modeArg === 'audit' ? 'audit' : 'repair'

  const dryRun = args.includes('--dry-run')

  const limitArg = getArg('--limit')
  const limit = limitArg ? Number(limitArg) || null : null

  return { mode, dryRun, limit }
}

async function main() {
  const { mode, dryRun, limit } = parseCliArgs()

  console.log('🔧 Phase 4 – Currency & Salary Repair')
  console.log(`   Mode    : ${mode}`)
  console.log(`   Dry run : ${dryRun ? 'YES (no writes)' : 'no'}`)
  console.log(`   Limit   : ${limit ?? 'none'}`)
  console.log('')

  const countryCodesToCheck = Object.keys(COUNTRY_TO_CURRENCY)

  const whereClause: Prisma.JobWhereInput = {
    OR: [
      {
        countryCode: {
          in: countryCodesToCheck,
        },
      },
      {
        salaryMin: {
          not: null,
        },
      },
      {
        salaryMax: {
          not: null,
        },
      },
      {
        currency: {
          not: null,
        },
      },
    ],
  }

  const jobs = await prisma.job.findMany({
    where: whereClause,
    take: limit ?? undefined,
  })

  console.log(`🔍 Loaded ${jobs.length} jobs for audit/repair`)
  if (jobs.length === 0) {
    console.log('✅ Nothing to do, exiting.')
    await prisma.$disconnect()
    return
  }

  let scanned = 0
  let withSalaryData = 0
  let mismatches = 0
  let fixed = 0
  let updatedHighSalaryFlag = 0

  for (const job of jobs) {
    scanned++

    const hasSalaryFields =
      job.salaryMin != null ||
      job.salaryMax != null ||
      job.salaryCurrency != null ||
      job.minAnnual != null ||
      job.maxAnnual != null

    if (!hasSalaryFields) {
      continue
    }
    withSalaryData++

    // 1) Recompute normalized salary from original fields
    const normalized = normalizeJobSalaryFields({
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      salaryCurrency: job.salaryCurrency ?? job.currency ?? null,
      salaryPeriod: job.salaryPeriod as any,
    })

    // 2) Check high-salary flag
    const newIsHighSalary = normalized.isHighSalary
    const newIsHundredKLocal = normalized.isHighSalary

    if (
      newIsHighSalary !== job.isHighSalary ||
      newIsHundredKLocal !== job.isHundredKLocal
    ) {
      updatedHighSalaryFlag++
    }

    // 3) Currency/location consistency check
    const countryCode = job.countryCode ?? null
    const currentCurrency =
      (normalized.currency as string | null) ?? job.currency ?? null

    const check = checkCurrencyLocationMismatch(countryCode, currentCurrency)
    if (check.isMismatch) {
      mismatches++
    }

    // Audit-only mode: no updates, just stats
    if (mode === 'audit') {
      continue
    }

    // 4) Build update payload
    const data: Partial<Job> = {}

    // Sync normalized fields
    if (normalized.minAnnual !== null) {
      data.minAnnual = normalized.minAnnual
    }
    if (normalized.maxAnnual !== null) {
      data.maxAnnual = normalized.maxAnnual
    }
    if (normalized.currency) {
      data.currency = String(normalized.currency)
    }

    data.isHighSalary = newIsHighSalary
    data.isHundredKLocal = newIsHundredKLocal

    // Fix mismatched currency labels based on location
    if (check.isMismatch && check.expectedCurrency) {
      data.currency = check.expectedCurrency

      if (
        job.salaryPeriod === 'year' ||
        job.salaryPeriod === 'annual' ||
        job.salaryPeriod === 'YEAR'
      ) {
        data.salaryCurrency = check.expectedCurrency
      }
    } else if (!currentCurrency && check.expectedCurrency) {
      // If currency is missing but country is known, set expected
      data.currency = check.expectedCurrency
    }

    const hasAnyUpdate = Object.keys(data).length > 0
    if (!hasAnyUpdate) continue

    fixed++

    if (dryRun) {
      if (fixed <= 20) {
        console.log(
          `• [DRY RUN] Job ${job.id} (${job.title}) – country=${countryCode}, ` +
            `oldCurrency=${job.currency ?? job.salaryCurrency ?? 'null'} → newCurrency=${
              data.currency ?? 'unchanged'
            }`,
        )
      }
      continue
    }

    // 🚫 No Promise.all – update sequentially to avoid connection pool timeouts
    await prisma.job.update({
      where: { id: job.id },
      data,
    })

    if (fixed % 500 === 0) {
      console.log(`   …updated ${fixed} jobs so far`)
    }
  }

  console.log('')
  console.log('📊 Summary')
  console.log('----------')
  console.log(`Jobs scanned                          : ${scanned}`)
  console.log(`Jobs with salary data                 : ${withSalaryData}`)
  console.log(`Currency/location mismatches detected : ${mismatches}`)
  console.log(`Jobs with updated high-salary flags   : ${updatedHighSalaryFlag}`)
  if (mode === 'repair') {
    console.log(
      `Jobs ${dryRun ? 'that WOULD be ' : ''}updated     : ${fixed}`,
    )
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('💥 Error in repairCurrencyAndSalary.ts')
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
