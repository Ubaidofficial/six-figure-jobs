// scripts/salarySanityCleanupV3.ts
// Final pass - tighter thresholds and role-based validation
// Run: npx ts-node scripts/salarySanityCleanupV3.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// More realistic max salaries (most tech roles cap around $400-500K)
const CONFIG = {
  MAX_ANNUAL: {
    USD: 500_000,
    EUR: 450_000,
    GBP: 400_000,
    CAD: 550_000,
    AUD: 550_000,
    CHF: 500_000,
    INR: 20_000_000,
    SGD: 500_000,
    NZD: 450_000,
    SEK: 5_000_000,
  } as Record<string, number>,
  DEFAULT_MAX: 500_000,
  
  // Entry/mid-level roles should have lower caps
  ENTRY_LEVEL_MAX: 150_000,
  ENTRY_LEVEL_PATTERNS: [
    /\b(intern|internship)\b/i,
    /\b(junior|jr\.?)\b/i,
    /\b(entry.?level)\b/i,
    /\b(associate)\b/i,
    /\b(coordinator)\b/i,
    /\b(specialist)\b/i,
    /\b(representative|rep)\b/i,
    /\b(analyst I|analyst 1)\b/i,
    /\b(technician)\b/i,
    /\bsdr\b/i,
    /\bbdr\b/i,
    /\badr\b/i,
    /account.?development/i,
    /sales.?development/i,
    /business.?development.?rep/i,
  ],
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

function isEntryLevelTitle(title: string): boolean {
  return CONFIG.ENTRY_LEVEL_PATTERNS.some(pattern => pattern.test(title))
}

function getMaxForCurrency(currency: string | null): number {
  return CONFIG.MAX_ANNUAL[currency || 'USD'] || CONFIG.DEFAULT_MAX
}

async function main() {
  console.log('🔍 Salary Sanity Cleanup V3 (Final Pass)\n')
  
  // Before stats
  const before = {
    withSalary: await prisma.job.count({ where: { OR: [{ minAnnual: { not: null } }, { maxAnnual: { not: null } }] }}),
    highSalary: await prisma.job.count({ where: { isHighSalary: true } }),
    over500k: await prisma.job.count({ where: { OR: [{ minAnnual: { gt: 500_000n } }, { maxAnnual: { gt: 500_000n } }] }}),
  }
  
  console.log(`📊 BEFORE: ${before.withSalary} with salary, ${before.highSalary} high-salary, ${before.over500k} over $500K\n`)

  // STEP 1: Clear jobs over $500K (99% of tech jobs are under this)
  let cleared = 0
  for (const [currency, maxSalary] of Object.entries(CONFIG.MAX_ANNUAL)) {
    const result = await prisma.job.updateMany({
      where: { 
        currency, 
        OR: [{ minAnnual: { gt: BigInt(maxSalary) } }, { maxAnnual: { gt: BigInt(maxSalary) } }] 
      },
      data: { minAnnual: null, maxAnnual: null, isHighSalary: false }
    })
    if (result.count > 0) {
      console.log(`  ${currency}: Cleared ${result.count} jobs over ${formatMoney(maxSalary, currency)}`)
      cleared += result.count
    }
  }
  
  // Unknown currency
  const unknownResult = await prisma.job.updateMany({
    where: { 
      currency: null, 
      OR: [{ minAnnual: { gt: BigInt(CONFIG.DEFAULT_MAX) } }, { maxAnnual: { gt: BigInt(CONFIG.DEFAULT_MAX) } }] 
    },
    data: { minAnnual: null, maxAnnual: null, isHighSalary: false }
  })
  cleared += unknownResult.count
  
  console.log(`\n✅ Step 1: Cleared ${cleared} jobs over max thresholds`)

  // STEP 2: Clear entry-level roles with unrealistic salaries (> $150K)
  const entryLevelJobs = await prisma.job.findMany({
    where: {
      OR: [
        { minAnnual: { gt: BigInt(CONFIG.ENTRY_LEVEL_MAX) } },
        { maxAnnual: { gt: BigInt(CONFIG.ENTRY_LEVEL_MAX) } },
      ]
    },
    select: { id: true, title: true, minAnnual: true, maxAnnual: true, currency: true }
  })
  
  let entryCleared = 0
  for (const job of entryLevelJobs) {
    if (isEntryLevelTitle(job.title)) {
      await prisma.job.update({
        where: { id: job.id },
        data: { minAnnual: null, maxAnnual: null, isHighSalary: false }
      })
      entryCleared++
      if (entryCleared <= 5) {
        console.log(`  Cleared: "${job.title}" - ${formatMoney(job.maxAnnual, job.currency || 'USD')}`)
      }
    }
  }
  
  console.log(`\n✅ Step 2: Cleared ${entryCleared} entry-level roles with inflated salaries`)

  // STEP 3: Recalculate isHighSalary
  await prisma.job.updateMany({
    where: { OR: [{ minAnnual: { gte: 100_000n } }, { maxAnnual: { gte: 100_000n } }], isHighSalary: false },
    data: { isHighSalary: true }
  })
  await prisma.job.updateMany({
    where: { 
      AND: [
        { OR: [{ minAnnual: { lt: 100_000n } }, { minAnnual: null }] },
        { OR: [{ maxAnnual: { lt: 100_000n } }, { maxAnnual: null }] },
      ],
      isHighSalary: true 
    },
    data: { isHighSalary: false }
  })
  
  console.log(`\n✅ Step 3: Recalculated isHighSalary flags`)

  // Final stats
  const after = {
    withSalary: await prisma.job.count({ where: { OR: [{ minAnnual: { not: null } }, { maxAnnual: { not: null } }] }}),
    highSalary: await prisma.job.count({ where: { isHighSalary: true } }),
    over500k: await prisma.job.count({ where: { OR: [{ minAnnual: { gt: 500_000n } }, { maxAnnual: { gt: 500_000n } }] }}),
  }
  
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 FINAL STATS:`)
  console.log(`   Jobs with salary: ${after.withSalary} (was ${before.withSalary})`)
  console.log(`   High salary ($100K+): ${after.highSalary} (was ${before.highSalary})`)
  console.log(`   Over $500K: ${after.over500k} (was ${before.over500k})`)

  // Top 15 sanity check
  console.log(`\n🔝 TOP 15 HIGHEST SALARIES:`)
  const topJobs = await prisma.job.findMany({
    where: { maxAnnual: { not: null } },
    orderBy: { maxAnnual: 'desc' },
    take: 15,
    select: { title: true, company: true, minAnnual: true, maxAnnual: true, currency: true }
  })
  
  for (const job of topJobs) {
    const c = job.currency || 'USD'
    console.log(`  ${formatMoney(job.maxAnnual, c).padEnd(12)} ${job.title.slice(0, 50)} @ ${job.company}`)
  }

  // Salary distribution
  console.log(`\n📈 SALARY DISTRIBUTION:`)
  const ranges = [
    { label: '$100K-$150K', min: 100_000n, max: 150_000n },
    { label: '$150K-$200K', min: 150_000n, max: 200_000n },
    { label: '$200K-$300K', min: 200_000n, max: 300_000n },
    { label: '$300K-$400K', min: 300_000n, max: 400_000n },
    { label: '$400K-$500K', min: 400_000n, max: 500_000n },
  ]
  
  for (const range of ranges) {
    const count = await prisma.job.count({
      where: {
        OR: [
          { maxAnnual: { gte: range.min, lt: range.max } },
          { AND: [{ maxAnnual: null }, { minAnnual: { gte: range.min, lt: range.max } }] }
        ]
      }
    })
    console.log(`   ${range.label}: ${count} jobs`)
  }

  await prisma.$disconnect()
  console.log(`\n✅ Cleanup complete!`)
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })