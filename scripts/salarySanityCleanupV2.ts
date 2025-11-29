// scripts/salarySanityCleanupV2.ts
// Aggressive salary cleanup - fixes Greenhouse cents issue + clears bad data
// Run: npx ts-node scripts/salarySanityCleanupV2.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CONFIG = {
  MAX_ANNUAL: {
    USD: 800_000,
    EUR: 700_000,
    GBP: 600_000,
    CAD: 900_000,
    AUD: 900_000,
    CHF: 800_000,
    INR: 30_000_000,
    SGD: 800_000,
    NZD: 700_000,
    SEK: 8_000_000,
  } as Record<string, number>,
  DEFAULT_MAX: 800_000,
  MIN_ANNUAL: 15_000,
}

function getMaxForCurrency(currency: string | null): number {
  return CONFIG.MAX_ANNUAL[currency || 'USD'] || CONFIG.DEFAULT_MAX
}

function formatMoney(value: bigint | number | null, currency: string = 'USD'): string {
  if (value === null) return 'null'
  const num = typeof value === 'bigint' ? Number(value) : value
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num)
  } catch {
    return `${currency} ${num.toLocaleString()}`
  }
}

async function main() {
  console.log('🔍 Salary Sanity Cleanup V2\n')
  
  const totalJobs = await prisma.job.count()
  const jobsWithSalary = await prisma.job.count({
    where: { OR: [{ minAnnual: { not: null } }, { maxAnnual: { not: null } }] }
  })
  const highSalaryJobs = await prisma.job.count({ where: { isHighSalary: true } })
  const over1M = await prisma.job.count({
    where: { OR: [{ minAnnual: { gt: 1_000_000n } }, { maxAnnual: { gt: 1_000_000n } }] }
  })
  const over10M = await prisma.job.count({
    where: { OR: [{ minAnnual: { gt: 10_000_000n } }, { maxAnnual: { gt: 10_000_000n } }] }
  })
  
  console.log(`📊 BEFORE: ${totalJobs} jobs, ${jobsWithSalary} with salary, ${highSalaryJobs} high-salary`)
  console.log(`⚠️  Over $1M: ${over1M}, Over $10M: ${over10M}\n`)

  // STEP 1: Clear extreme outliers (> $10M)
  const extremeOutliers = await prisma.job.updateMany({
    where: { OR: [{ minAnnual: { gt: 10_000_000n } }, { maxAnnual: { gt: 10_000_000n } }] },
    data: { minAnnual: null, maxAnnual: null, isHighSalary: false }
  })
  console.log(`✅ Step 1: Cleared ${extremeOutliers.count} jobs > $10M`)

  // STEP 2: Fix "stored in cents" ($1M-$10M range)
  const possibleCents = await prisma.job.findMany({
    where: { OR: [
      { minAnnual: { gte: 1_000_000n, lte: 10_000_000n } },
      { maxAnnual: { gte: 1_000_000n, lte: 10_000_000n } }
    ]},
    select: { id: true, minAnnual: true, maxAnnual: true, currency: true }
  })
  
  let centsFixed = 0, centsCleared = 0
  for (const job of possibleCents) {
    const minVal = job.minAnnual ? Number(job.minAnnual) : null
    const maxVal = job.maxAnnual ? Number(job.maxAnnual) : null
    const maxAllowed = getMaxForCurrency(job.currency)
    
    const minFixed = minVal ? minVal / 100 : null
    const maxFixed = maxVal ? maxVal / 100 : null
    
    const minOk = minFixed === null || (minFixed >= CONFIG.MIN_ANNUAL && minFixed <= maxAllowed)
    const maxOk = maxFixed === null || (maxFixed >= CONFIG.MIN_ANNUAL && maxFixed <= maxAllowed)
    
    if (minOk && maxOk && (minFixed || maxFixed)) {
      const newMin = minFixed ? BigInt(Math.round(minFixed)) : null
      const newMax = maxFixed ? BigInt(Math.round(maxFixed)) : null
      await prisma.job.update({
        where: { id: job.id },
        data: { minAnnual: newMin, maxAnnual: newMax, isHighSalary: (newMax || newMin || 0) >= 100_000 }
      })
      centsFixed++
    } else {
      await prisma.job.update({
        where: { id: job.id },
        data: { minAnnual: null, maxAnnual: null, isHighSalary: false }
      })
      centsCleared++
    }
  }
  console.log(`✅ Step 2: Fixed ${centsFixed} (÷100), cleared ${centsCleared}`)

  // STEP 3: Clear remaining per-currency outliers
  let currencyCleared = 0
  for (const [currency, maxSalary] of Object.entries(CONFIG.MAX_ANNUAL)) {
    const result = await prisma.job.updateMany({
      where: { currency, OR: [{ minAnnual: { gt: BigInt(maxSalary) } }, { maxAnnual: { gt: BigInt(maxSalary) } }] },
      data: { minAnnual: null, maxAnnual: null, isHighSalary: false }
    })
    currencyCleared += result.count
  }
  const unknownCleared = await prisma.job.updateMany({
    where: { currency: null, OR: [{ minAnnual: { gt: BigInt(CONFIG.DEFAULT_MAX) } }, { maxAnnual: { gt: BigInt(CONFIG.DEFAULT_MAX) } }] },
    data: { minAnnual: null, maxAnnual: null, isHighSalary: false }
  })
  console.log(`✅ Step 3: Cleared ${currencyCleared + unknownCleared.count} currency outliers`)

  // STEP 4: Recalculate isHighSalary
  await prisma.job.updateMany({
    where: { OR: [{ minAnnual: { gte: 100_000n } }, { maxAnnual: { gte: 100_000n } }], isHighSalary: false },
    data: { isHighSalary: true }
  })
  await prisma.job.updateMany({
    where: { minAnnual: { lt: 100_000n }, maxAnnual: { lt: 100_000n }, isHighSalary: true },
    data: { isHighSalary: false }
  })
  await prisma.job.updateMany({
    where: { minAnnual: null, maxAnnual: null, isHighSalary: true },
    data: { isHighSalary: false }
  })
  console.log(`✅ Step 4: Recalculated isHighSalary flags`)

  // Final stats
  const finalWithSalary = await prisma.job.count({ where: { OR: [{ minAnnual: { not: null } }, { maxAnnual: { not: null } }] }})
  const finalHighSalary = await prisma.job.count({ where: { isHighSalary: true } })
  const finalOver1M = await prisma.job.count({ where: { OR: [{ minAnnual: { gt: 1_000_000n } }, { maxAnnual: { gt: 1_000_000n } }] }})
  
  console.log(`\n📊 AFTER: ${finalWithSalary} with salary, ${finalHighSalary} high-salary, ${finalOver1M} over $1M`)

  // Top 10 sanity check
  console.log(`\n🔝 TOP 10 HIGHEST SALARIES:`)
  const topJobs = await prisma.job.findMany({
    where: { maxAnnual: { not: null } },
    orderBy: { maxAnnual: 'desc' },
    take: 10,
    select: { title: true, company: true, minAnnual: true, maxAnnual: true, currency: true }
  })
  for (const job of topJobs) {
    const c = job.currency || 'USD'
    console.log(`  ${formatMoney(job.maxAnnual, c)} - ${job.title} @ ${job.company}`)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })