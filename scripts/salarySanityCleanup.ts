// scripts/salarySanityCleanup.ts
// Find and fix salary outliers (jobs with unrealistic salary values)
// Run: npx ts-node scripts/salarySanityCleanup.ts
// Run with --fix flag to actually apply fixes: npx ts-node scripts/salarySanityCleanup.ts --fix

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

// ============================================
// Configuration - Salary thresholds
// ============================================

const SALARY_THRESHOLDS = {
  // Absolute maximum reasonable annual salary (anything above is wrong)
  MAX_REASONABLE_ANNUAL: 1_000_000, // $1M - even CEO salaries rarely exceed this
  
  // Per-currency maximums (in local currency)
  CURRENCY_MAX: {
    USD: 1_000_000,
    EUR: 900_000,
    GBP: 800_000,
    CAD: 1_200_000,
    AUD: 1_200_000,
    CHF: 900_000,
    INR: 50_000_000, // ~$600K USD
    SGD: 1_200_000,
    NZD: 1_200_000,
    SEK: 10_000_000,
  } as Record<string, number>,
  
  // Minimum sensible annual salary (below this, probably hourly rate mistake)
  MIN_REASONABLE_ANNUAL: 20_000,
  
  // Suspected hourly rates misinterpreted as annual
  HOURLY_RATE_THRESHOLD: 500, // If salary < $500, probably an hourly rate
  
  // Common multipliers for fixing
  HOURLY_TO_ANNUAL: 2080, // 40 hours/week * 52 weeks
  MONTHLY_TO_ANNUAL: 12,
  DAILY_TO_ANNUAL: 260, // ~260 working days/year
}

// ============================================
// Types
// ============================================

interface SalaryOutlier {
  id: string
  title: string
  company: string
  salaryRaw: string | null
  minAnnual: bigint | null
  maxAnnual: bigint | null
  currency: string | null
  source: string
  issueType: string
  suggestedFix: string
}

interface CleanupStats {
  totalJobs: number
  jobsWithSalary: number
  outliers: {
    tooHigh: number
    tooLow: number
    suspectedHourly: number
    suspectedMonthly: number
    negativeOrZero: number
  }
  fixed: number
  flagged: number
}

// ============================================
// Analysis Functions
// ============================================

async function findSalaryOutliers(): Promise<SalaryOutlier[]> {
  const outliers: SalaryOutlier[] = []
  
  // Find jobs with any salary data
  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { minAnnual: { not: null } },
        { maxAnnual: { not: null } },
      ]
    },
    select: {
      id: true,
      title: true,
      company: true,
      salaryRaw: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      source: true,
      salaryPeriod: true,
    }
  })
  
  for (const job of jobs) {
    const minAnnual = job.minAnnual ? Number(job.minAnnual) : null
    const maxAnnual = job.maxAnnual ? Number(job.maxAnnual) : null
    const currency = job.currency || 'USD'
    const maxReasonable = SALARY_THRESHOLDS.CURRENCY_MAX[currency] || SALARY_THRESHOLDS.MAX_REASONABLE_ANNUAL
    
    // Check for negative or zero values
    if ((minAnnual !== null && minAnnual <= 0) || (maxAnnual !== null && maxAnnual <= 0)) {
      outliers.push({
        ...job,
        issueType: 'NEGATIVE_OR_ZERO',
        suggestedFix: 'Set salary fields to null',
      })
      continue
    }
    
    // Check for impossibly high salaries (> $1M or currency equivalent)
    if ((minAnnual && minAnnual > maxReasonable) || (maxAnnual && maxAnnual > maxReasonable)) {
      const highValue = Math.max(minAnnual || 0, maxAnnual || 0)
      
      // Check if it might be in cents (divide by 100)
      if (highValue > 100_000_000) {
        outliers.push({
          ...job,
          issueType: 'POSSIBLY_IN_CENTS',
          suggestedFix: `Divide by 100: ${highValue} → ${highValue / 100}`,
        })
      } 
      // Check if monthly was stored as annual
      else if (highValue / 12 < maxReasonable && highValue / 12 > SALARY_THRESHOLDS.MIN_REASONABLE_ANNUAL) {
        outliers.push({
          ...job,
          issueType: 'POSSIBLY_MONTHLY_AS_ANNUAL',
          suggestedFix: `Already monthly? Keep as-is or divide by 12`,
        })
      }
      else {
        outliers.push({
          ...job,
          issueType: 'TOO_HIGH',
          suggestedFix: 'Set salary to null (unreliable data)',
        })
      }
      continue
    }
    
    // Check for suspiciously low values (might be hourly rates)
    if ((minAnnual && minAnnual < SALARY_THRESHOLDS.HOURLY_RATE_THRESHOLD) || 
        (maxAnnual && maxAnnual < SALARY_THRESHOLDS.HOURLY_RATE_THRESHOLD)) {
      const lowValue = minAnnual || maxAnnual || 0
      const asAnnual = lowValue * SALARY_THRESHOLDS.HOURLY_TO_ANNUAL
      
      // Only flag if converting to annual gives reasonable value
      if (asAnnual >= SALARY_THRESHOLDS.MIN_REASONABLE_ANNUAL && asAnnual <= maxReasonable) {
        outliers.push({
          ...job,
          issueType: 'SUSPECTED_HOURLY',
          suggestedFix: `Multiply by 2080: ${lowValue} → ${asAnnual}`,
        })
      } else {
        outliers.push({
          ...job,
          issueType: 'TOO_LOW',
          suggestedFix: 'Set salary to null (unreliable data)',
        })
      }
      continue
    }
    
    // Check for values that look like monthly salaries stored as annual
    // Monthly salary in $5K-$50K range stored as annual
    if ((minAnnual && minAnnual >= 5000 && minAnnual <= 50000) ||
        (maxAnnual && maxAnnual >= 5000 && maxAnnual <= 50000)) {
      const value = minAnnual || maxAnnual || 0
      const asAnnualFromMonthly = value * 12
      
      // Check if the salaryRaw suggests it's monthly
      const salaryRaw = job.salaryRaw?.toLowerCase() || ''
      if (salaryRaw.includes('month') || salaryRaw.includes('/mo') || salaryRaw.includes('pm')) {
        outliers.push({
          ...job,
          issueType: 'SUSPECTED_MONTHLY',
          suggestedFix: `Multiply by 12: ${value} → ${asAnnualFromMonthly}`,
        })
      }
    }
  }
  
  return outliers
}

// ============================================
// Display Functions
// ============================================

function formatCurrency(value: number | bigint | null, currency: string = 'USD'): string {
  if (value === null) return 'null'
  const num = typeof value === 'bigint' ? Number(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0,
  }).format(num)
}

function displayOutliers(outliers: SalaryOutlier[]): void {
  const grouped = outliers.reduce((acc, o) => {
    acc[o.issueType] = acc[o.issueType] || []
    acc[o.issueType].push(o)
    return acc
  }, {} as Record<string, SalaryOutlier[]>)
  
  __slog('\n' + '='.repeat(80))
  __slog('SALARY OUTLIER ANALYSIS')
  __slog('='.repeat(80))
  
  for (const [issueType, jobs] of Object.entries(grouped)) {
    __slog(`\n📊 ${issueType} (${jobs.length} jobs)`)
    __slog('-'.repeat(60))
    
    // Show first 10 examples
    const examples = jobs.slice(0, 10)
    for (const job of examples) {
      __slog(`
  ID: ${job.id}
  Title: ${job.title}
  Company: ${job.company}
  Raw: ${job.salaryRaw || 'N/A'}
  Min: ${formatCurrency(job.minAnnual, job.currency || 'USD')}
  Max: ${formatCurrency(job.maxAnnual, job.currency || 'USD')}
  Currency: ${job.currency || 'null'}
  Source: ${job.source}
  Fix: ${job.suggestedFix}
`)
    }
    
    if (jobs.length > 10) {
      __slog(`  ... and ${jobs.length - 10} more`)
    }
  }
}

// ============================================
// Fix Functions
// ============================================

async function fixOutliers(outliers: SalaryOutlier[], dryRun: boolean = true): Promise<number> {
  let fixed = 0
  
  for (const outlier of outliers) {
    const minAnnual = outlier.minAnnual ? Number(outlier.minAnnual) : null
    const maxAnnual = outlier.maxAnnual ? Number(outlier.maxAnnual) : null
    
    let updates: {
      minAnnual?: bigint | null
      maxAnnual?: bigint | null
      isHighSalary?: boolean
    } = {}
    
    switch (outlier.issueType) {
      case 'NEGATIVE_OR_ZERO':
      case 'TOO_HIGH':
      case 'TOO_LOW':
        // Clear salary data for unreliable entries
        updates = {
          minAnnual: null,
          maxAnnual: null,
          isHighSalary: false,
        }
        break
        
      case 'POSSIBLY_IN_CENTS':
        // Divide by 100
        updates = {
          minAnnual: minAnnual ? BigInt(Math.round(minAnnual / 100)) : null,
          maxAnnual: maxAnnual ? BigInt(Math.round(maxAnnual / 100)) : null,
        }
        // Recalculate isHighSalary
        const fixedMax = maxAnnual ? maxAnnual / 100 : (minAnnual ? minAnnual / 100 : 0)
        updates.isHighSalary = fixedMax >= 100000
        break
        
      case 'SUSPECTED_HOURLY':
        // Convert hourly to annual
        updates = {
          minAnnual: minAnnual ? BigInt(Math.round(minAnnual * SALARY_THRESHOLDS.HOURLY_TO_ANNUAL)) : null,
          maxAnnual: maxAnnual ? BigInt(Math.round(maxAnnual * SALARY_THRESHOLDS.HOURLY_TO_ANNUAL)) : null,
        }
        const hourlyFixedMax = maxAnnual ? maxAnnual * 2080 : (minAnnual ? minAnnual * 2080 : 0)
        updates.isHighSalary = hourlyFixedMax >= 100000
        break
        
      case 'SUSPECTED_MONTHLY':
        // Convert monthly to annual
        updates = {
          minAnnual: minAnnual ? BigInt(Math.round(minAnnual * 12)) : null,
          maxAnnual: maxAnnual ? BigInt(Math.round(maxAnnual * 12)) : null,
        }
        const monthlyFixedMax = maxAnnual ? maxAnnual * 12 : (minAnnual ? minAnnual * 12 : 0)
        updates.isHighSalary = monthlyFixedMax >= 100000
        break
        
      case 'POSSIBLY_MONTHLY_AS_ANNUAL':
        // Skip - ambiguous, needs manual review
        continue
    }
    
    if (Object.keys(updates).length > 0) {
      if (dryRun) {
        __slog(`  [DRY RUN] Would update ${outlier.id}: ${JSON.stringify(updates)}`)
      } else {
        await prisma.job.update({
          where: { id: outlier.id },
          data: updates,
        })
      }
      fixed++
    }
  }
  
  return fixed
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2)
  const shouldFix = args.includes('--fix')
  
  __slog('🔍 Analyzing salary data...\n')
  
  // Get total stats
  const totalJobs = await prisma.job.count()
  const jobsWithSalary = await prisma.job.count({
    where: {
      OR: [
        { minAnnual: { not: null } },
        { maxAnnual: { not: null } },
      ]
    }
  })
  
  __slog(`📈 Total jobs: ${totalJobs.toLocaleString()}`)
  __slog(`💰 Jobs with salary data: ${jobsWithSalary.toLocaleString()}`)
  
  // Quick stats on extreme values
  const extremeHigh = await prisma.job.count({
    where: {
      OR: [
        { minAnnual: { gt: BigInt(1_000_000) } },
        { maxAnnual: { gt: BigInt(1_000_000) } },
      ]
    }
  })
  
  const extremeVeryHigh = await prisma.job.count({
    where: {
      OR: [
        { minAnnual: { gt: BigInt(10_000_000) } },
        { maxAnnual: { gt: BigInt(10_000_000) } },
      ]
    }
  })
  
  __slog(`\n⚠️  Jobs with salary > $1M: ${extremeHigh}`)
  __slog(`🚨 Jobs with salary > $10M: ${extremeVeryHigh}`)
  
  // Find outliers
  const outliers = await findSalaryOutliers()
  
  // Display analysis
  displayOutliers(outliers)
  
  // Summary
  __slog('\n' + '='.repeat(80))
  __slog('SUMMARY')
  __slog('='.repeat(80))
  
  const byType = outliers.reduce((acc, o) => {
    acc[o.issueType] = (acc[o.issueType] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  __slog('\nOutliers by type:')
  for (const [type, count] of Object.entries(byType)) {
    __slog(`  ${type}: ${count}`)
  }
  __slog(`\nTotal outliers: ${outliers.length}`)
  
  // Fix if requested
  if (shouldFix) {
    __slog('\n🔧 Applying fixes...')
    const fixed = await fixOutliers(outliers, false)
    __slog(`✅ Fixed ${fixed} jobs`)
  } else {
    __slog('\n💡 Run with --fix flag to apply corrections:')
    __slog('   npx ts-node scripts/salarySanityCleanup.ts --fix')
    
    // Show dry run preview
    __slog('\n📝 Dry run preview (first 5 fixes):')
    await fixOutliers(outliers.slice(0, 5), true)
  }
  
  // Show top outliers for manual review
  __slog('\n' + '='.repeat(80))
  __slog('TOP 20 HIGHEST SALARY VALUES (for manual review)')
  __slog('='.repeat(80))
  
  const topHighest = await prisma.job.findMany({
    where: {
      OR: [
        { minAnnual: { not: null } },
        { maxAnnual: { not: null } },
      ]
    },
    orderBy: { maxAnnual: 'desc' },
    take: 20,
    select: {
      id: true,
      title: true,
      company: true,
      salaryRaw: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      source: true,
    }
  })
  
  for (const job of topHighest) {
    __slog(`
${job.title} @ ${job.company}
  Raw: ${job.salaryRaw || 'N/A'}
  Range: ${formatCurrency(job.minAnnual, job.currency || 'USD')} - ${formatCurrency(job.maxAnnual, job.currency || 'USD')}
  Source: ${job.source}
`)
  }
  
  await prisma.$disconnect()
}

main().catch((e) => {
  __serr('Error:', e)
  prisma.$disconnect()
  process.exit(1)
})