// scripts/salarySanityCleanupV2.ts
// Aggressive salary cleanup - fixes Greenhouse cents issue + clears bad data
// Run: npx ts-node scripts/salarySanityCleanupV2.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // Maximum reasonable annual salaries by currency
  MAX_ANNUAL: {
    USD: 800_000,
    EUR: 700_000,
    GBP: 600_000,
    CAD: 900_000,
    AUD: 900_000,
    CHF: 800_000,
    INR: 30_000_000, // ~$360K USD
    SGD: 800_000,
    NZD: 700_000,
    SEK: 8_000_000,
  } as Record<string, number>,
  
  // Default max if currency not in list
  DEFAULT_MAX: 800_000,
  
  // Minimum annual salary (below this = probably hourly or bad data)
  MIN_ANNUAL: 15_000,
}

// ============================================
// Helper Functions
// ============================================

function getMaxForCurrency(currency: string | null): number {
  return CONFIG.MAX_ANNUAL[currency || 'USD'] || CONFIG.DEFAULT_MAX
}

function formatMoney(value: bigint | number | null, currency: string = 'USD'): string {
  if (value === null) return 'null'
  const num = typeof value === 'bigint' ? Number(value) : value
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(num)
  } catch {
    return `${currency} ${num.toLocaleString()}`
  }
}

// ============================================
// Main Cleanup Logic
// ============================================

async function main() {
  console.log('🔍 Salary Sanity Cleanup V2\n')
  console.log('='.repeat(70))
  
  // Stats before
  const totalJobs = await prisma.job.count()
  const jobsWithSalary = await prisma.job.count({
    where: { OR: [{ minAnnual: { not: null } }, { maxAnnual: { not: null } }] }
  })
  const highSalaryJobs = await prisma.job.count({ where: { isHighSalary: true } })
  
  console.log(`📊 BEFORE CLEANUP:`)
  console.log(`   Total jobs: ${totalJobs.toLocaleString()}`)
  console.log(`   Jobs with salary: ${jobsWithSalary.toLocaleString()}`)
  console.log(`   High salary jobs: ${highSalaryJobs.toLocaleString()}`)
  
  // Count extreme values
  const over1M = await prisma.job.count({
    where: { OR: [{ minAnnual: { gt: 1_000_000n } }, { maxAnnual: { gt: 1_000_000n } }] }
  })
  const over10M = await prisma.job.count({
    where: { OR: [{ minAnnual: { gt: 10_000_000n } }, { maxAnnual: { gt: 10_000_000n } }] }
  })
  
  console.log(`\n⚠️  Jobs with salary > $1M: ${over1M}`)
  console.log(`🚨 Jobs with salary > $10M: ${over10M}`)
  
  // ============================================
  // STEP 1: Clear all obviously bad data (> $10M)
  // ============================================
  console.log('\n' + '='.repeat(70))
  console.log('STEP 1: Clearing extreme outliers (> $10M)')
  console.log('='.repeat(70))
  
  const extremeOutliers = await prisma.job.updateMany({
    where: {
      OR: [
        { minAnnual: { gt: 10_000_000n } },
        { maxAnnual: { gt: 10_000_000n } },
      ]
    },
    data: {
      minAnnual: null,
      maxAnnual: null,
      isHighSalary: false,
    }
  })
  console.log(`✅ Cleared ${extremeOutliers.count} jobs with salaries > $10M`)
  
  // ============================================
  // STEP 2: Fix "stored in cents" issue (divide by 100)
  // Values between $1M and $10M that become reasonable when /100
  // ============================================
  console.log('\n' + '='.repeat(70))
  console.log('STEP 2: Fixing "stored in cents" issue')
  console.log('='.repeat(70))
  
  // Find jobs that look like they're in cents
  const possibleCents = await prisma.job.findMany({
    where: {
      OR: [
        { minAnnual: { gte: 1_000_000n, lte: 10_000_000n } },
        { maxAnnual: { gte: 1_000_000n, lte: 10_000_000n } },
      ]
    },
    select: {
      id: true,
      title: true,
      company: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
    }
  })
  
  let centsFixed = 0
  let centsCleared = 0
  
  for (const job of possibleCents) {
    const minVal = job.minAnnual ? Number(job.minAnnual) : null
    const maxVal = job.maxAnnual ? Number(job.maxAnnual) : null
    const maxAllowed = getMaxForCurrency(job.currency)
    
    // Check if dividing by 100 gives reasonable values
    const minFixed = minVal ? minVal / 100 : null
    const maxFixed = maxVal ? maxVal / 100 : null
    
    const minReasonable = minFixed === null || (minFixed >= CONFIG.MIN_ANNUAL && minFixed <= maxAllowed)
    const maxReasonable = maxFixed === null || (maxFixed >= CONFIG.MIN_ANNUAL && maxFixed <= maxAllowed)
    
    if (minReasonable && maxReasonable && (minFixed || maxFixed)) {
      // Fix by dividing by 100
      const newMin = minFixed ? BigInt(Math.round(minFixed)) : null
      const newMax = maxFixed ? BigInt(Math.round(maxFixed)) : null
      const isHigh = (newMax || newMin || 0) >= 100_000
      
      await prisma.job.update({
        where: { id: job.id },
        data: {
          minAnnual: newMin,
          maxAnnual: newMax,
          isHighSalary: isHigh,
        }
      })
      centsFixed++
    } else {
      // Can't fix - clear it
      await prisma.job.update({
        where: { id: job.id },
        data: {
          minAnnual: null,
          maxAnnual: null,
          isHighSalary: false,
        }
      })
      centsCleared++
    }
  }
  
  console.log(`✅ Fixed ${centsFixed} jobs (divided by 100)`)
  console.log(`⚠️  Cleared ${centsCleared} jobs (couldn't salvage)`)
  
  // ============================================
  // STEP 3: Clear remaining outliers per currency
  // ============================================
  console.log('\n' + '='.repeat(70))
  console.log('STEP 3: Clearing remaining outliers by currency')
  console.log('='.repeat(70))
  
  let currencyCleared = 0
  
  for (const [currency, maxSalary] of Object.entries(CONFIG.MAX_ANNUAL)) {
    const result = await prisma.job.updateMany({
      where: {
        currency,
        OR: [
          { minAnnual: { gt: BigInt(maxSalary) } },
          { maxAnnual: { gt: BigInt(maxSalary) } },
        ]
      },
      data: {
        minAnnual: null,
        maxAnnual: null,
        isHighSalary: false,
      }
    })
    
    if (result.count > 0) {
      console.log(`   ${currency}: Cleared ${result.count} jobs (max: ${formatMoney(maxSalary, currency)})`)
      currencyCleared += result.count
    }
  }
  
  // Clear jobs with unknown currencies that are too high
  const unknownCurrencyCleared = await prisma.job.updateMany({
    where: {
      currency: null,
      OR: [
        { minAnnual: { gt: BigInt(CONFIG.DEFAULT_MAX) } },
        { maxAnnual: { gt: BigInt(CONFIG.DEFAULT_MAX) } },
      ]
    },
    data: {
      minAnnual: null,
      maxAnnual: null,
      isHighSalary: false,
    }
  })
  
  console.log(`   Unknown currency: Cleared ${unknownCurrencyCleared.count} jobs`)
  currencyCleared += unknownCurrencyCleared.count
  
  console.log(`\n✅ Total currency-based cleanup: ${currencyCleared} jobs`)
  
  // ============================================
  // STEP 4: Recalculate isHighSalary flag
  // ============================================
  console.log('\n' + '='.repeat(70))
  console.log('STEP 4: Recalculating isHighSalary flags')
  console.log('='.repeat(70))
  
  // Set isHighSalary = true for jobs with salary >= 100k
  const setHighTrue = await prisma.job.updateMany({
    where: {
      OR: [
        { minAnnual: { gte: 100_000n } },
        { maxAnnual: { gte: 100_000n } },
      ],
      isHighSalary: false,
    },
    data: { isHighSalary: true }
  })
  
  // Set isHighSalary = false for jobs with salary < 100k
  const setHighFalse = await prisma.job.updateMany({
    where: {
      minAnnual: { lt: 100_000n },
      maxAnnual: { lt: 100_000n },
      isHighSalary: true,
    },
    data: { isHighSalary: false }
  })
  
  // Set isHighSalary = false for jobs with no salary
  const setHighFalseNull = await prisma.job.updateMany({
    where: {
      minAnnual: null,
      maxAnnual: null,
      isHighSalary: true,
    },
    data: { isHighSalary: false }
  })
  
  console.log(`✅ Set isHighSalary=true: ${setHighTrue.count} jobs`)
  console.log(`✅ Set isHighSalary=false: ${setHighFalse.count + setHighFalseNull.count} jobs`)
  
  // ============================================
  // Final Stats
  // ============================================
  console.log('\n' + '='.repeat(70))
  console.log('📊 AFTER CLEANUP:')
  console.log('='.repeat(70))
  
  const finalJobsWithSalary = await prisma.job.count({
    where: { OR: [{ minAnnual: { not: null } }, { maxAnnual: { not: null } }] }
  })
  const finalHighSalary = await prisma.job.count({ where: { isHighSalary: true } })
  const finalOver1M = await prisma.job.count({
    where: { OR: [{ minAnnual: { gt: 1_000_000n } }, { maxAnnual: { gt: 1_000_000n } }] }
  })
  
  console.log(`   Total jobs: ${totalJobs.toLocaleString()}`)
  console.log(`   Jobs with salary: ${finalJobsWithSalary.toLocaleString()} (was ${jobsWithSalary.toLocaleString()})`)
  console.log(`   High salary jobs: ${finalHighSalary.toLocaleString()} (was ${highSalaryJobs.toLocaleString()})`)
  console.log(`   Jobs > $1M: ${finalOver1M} (was ${over1M})`)
  
  // ============================================
  // Sample of remaining high-value jobs
  // ============================================
  console.log('\n' + '='.repeat(70))
  console.log('TOP 10 HIGHEST SALARIES (sanity check)')
  console.log('='.repeat(70))
  
  const topJobs = await prisma.job.findMany({
    where: { maxAnnual: { not: null } },
    orderBy: { maxAnnual: 'desc' },
    take: 10,
    select: {
      title: true,
      company: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      source: true,
    }
  })
  
  for (const job of topJobs) {
    const curr = job.currency || 'USD'
    console.log(`
${job.title} @ ${job.company}
  Range: ${formatMoney(job.minAnnual, curr)} - ${formatMoney(job.maxAnnual, curr)}
  Source: ${job.source}`)
  }
  
  console.log('\n✅ Cleanup complete!')
  
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  prisma.$disconnect()
  process.exit(1)
})