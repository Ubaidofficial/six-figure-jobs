/**
 * Six Figure Jobs - pSEO Monitoring Dashboard
 * 
 * Displays real-time metrics about pSEO page publishing and health.
 * 
 * Usage:
 *   npx tsx scripts/monitoring-dashboard.ts
 */

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

// ============================================================================
// TYPES
// ============================================================================

interface DashboardMetrics {
  // Publishing Stats
  totalActivePages: number
  pagesPublishedToday: number
  pagesPublishedThisWeek: number
  pagesPublishedThisMonth: number
  
  // Quality Metrics
  avgJobsPerPage: number
  pagesWithLowJobs: number
  pagesWithHighJobs: number
  
  // Performance
  totalJobs: number
  totalCompanies: number
  avgSalary: number
  
  // By Type
  byType: Record<string, number>
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.clear()
  __slog('═'.repeat(80))
  __slog(' '.repeat(20) + 'SIX FIGURE JOBS - pSEO DASHBOARD')
  __slog('═'.repeat(80))
  __slog('')

  try {
    const metrics = await gatherMetrics()
    displayMetrics(metrics)
  } catch (error) {
    __serr('❌ Error gathering metrics:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// ============================================================================
// METRICS GATHERING
// ============================================================================

async function gatherMetrics(): Promise<DashboardMetrics> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thisWeek = new Date(today)
  thisWeek.setDate(today.getDate() - today.getDay())

  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  // Total jobs
  const totalJobs = await prisma.job.count({
    where: {
      isExpired: false,
      OR: [{ isHighSalary: true }, { isHundredKLocal: true }],
    },
  })

  // Total companies
  const totalCompanies = await prisma.company.count()

  // Average salary
  const salaryStats = await prisma.job.aggregate({
    where: {
      isExpired: false,
      OR: [{ isHighSalary: true }, { isHundredKLocal: true }],
      salaryMin: { gt: 0n },
    },
    _avg: {
      salaryMin: true,
    },
  })

  // Job counts by role (simulating pSEO page stats)
  const roleStats = await prisma.job.groupBy({
    by: ['roleSlug'],
    where: {
      isExpired: false,
      OR: [{ isHighSalary: true }, { isHundredKLocal: true }],
      roleSlug: { not: null },
    },
    _count: { _all: true },
  })

  // Calculate metrics
  const roleJobCounts = roleStats.map((row) => row._count?._all ?? 0)
  const avgJobsPerPage =
    roleJobCounts.length > 0
      ? roleJobCounts.reduce((sum, count) => sum + count, 0) / roleJobCounts.length
      : 0

  const pagesWithLowJobs = roleJobCounts.filter((count) => count < 10).length
  const pagesWithHighJobs = roleJobCounts.filter((count) => count >= 100).length

  const avgSalaryMin = Number(salaryStats._avg?.salaryMin ?? 0)

  return {
    totalActivePages: roleStats.length,
    pagesPublishedToday: 0,  // TODO: Implement tracking
    pagesPublishedThisWeek: 0,  // TODO: Implement tracking
    pagesPublishedThisMonth: 0,  // TODO: Implement tracking
    avgJobsPerPage: Math.round(avgJobsPerPage),
    pagesWithLowJobs,
    pagesWithHighJobs,
    totalJobs,
    totalCompanies,
    avgSalary: Math.round(avgSalaryMin),
    byType: {
      role: roleStats.length,
      state: 0,  // TODO: Count state pages
      city: 0,   // TODO: Count city pages
      combo: 0,  // TODO: Count combo pages
    },
  }
}

// ============================================================================
// DISPLAY
// ============================================================================

function displayMetrics(m: DashboardMetrics) {
  // Overview Section
  __slog('📊 OVERVIEW')
  __slog('─'.repeat(80))
  __slog(`   Total Active Pages:     ${m.totalActivePages.toLocaleString()}`)
  __slog(`   Published Today:        ${m.pagesPublishedToday}`)
  __slog(`   Published This Week:    ${m.pagesPublishedThisWeek}`)
  __slog(`   Published This Month:   ${m.pagesPublishedThisMonth}`)
  __slog('')

  // Quality Section
  __slog('✅ QUALITY METRICS')
  __slog('─'.repeat(80))
  __slog(`   Avg Jobs per Page:      ${m.avgJobsPerPage}`)
  __slog(`   Pages with <10 jobs:    ${m.pagesWithLowJobs} ${m.pagesWithLowJobs > 5 ? '⚠️' : ''}`)
  __slog(`   Pages with 100+ jobs:   ${m.pagesWithHighJobs}`)
  __slog('')

  // Content Stats
  __slog('📈 CONTENT STATS')
  __slog('─'.repeat(80))
  __slog(`   Total $100k+ Jobs:      ${m.totalJobs.toLocaleString()}`)
  __slog(`   Total Companies:        ${m.totalCompanies.toLocaleString()}`)
  __slog(`   Avg Salary:             $${(m.avgSalary / 1000).toFixed(0)}k`)
  __slog('')

  // By Type
  __slog('📑 PAGES BY TYPE')
  __slog('─'.repeat(80))
  __slog(`   Role Pages:             ${m.byType.role}`)
  __slog(`   State Pages:            ${m.byType.state}`)
  __slog(`   City Pages:             ${m.byType.city}`)
  __slog(`   Combo Pages:            ${m.byType.combo}`)
  __slog('')

  // Health Check
  __slog('🏥 HEALTH CHECK')
  __slog('─'.repeat(80))

  const checks = []

  if (m.avgJobsPerPage >= 30) {
    checks.push('✅ Average jobs per page is healthy (30+)')
  } else if (m.avgJobsPerPage >= 15) {
    checks.push('⚠️  Average jobs per page is acceptable (15+) but could be better')
  } else {
    checks.push('❌ Average jobs per page is too low (<15) - consider raising minimum')
  }

  if (m.pagesWithLowJobs <= 5) {
    checks.push('✅ Few pages with low job counts (<10)')
  } else {
    checks.push(`⚠️  ${m.pagesWithLowJobs} pages have <10 jobs - consider deactivating`)
  }

  checks.forEach(check => __slog(`   ${check}`))
  __slog('')

  // Footer
  __slog('═'.repeat(80))
  __slog(`Last updated: ${new Date().toLocaleString()}`)
  __slog('═'.repeat(80))
}

// ============================================================================
// RUN
// ============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    __serr(error)
    process.exit(1)
  })
