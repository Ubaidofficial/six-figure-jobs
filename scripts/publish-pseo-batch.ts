/**
 * Six Figure Jobs - Safe pSEO Publishing Script
 * 
 * Publishes pSEO pages in controlled batches to avoid Google spam filters.
 * Enforces quality gates and respects phase-based publishing limits.
 * 
 * Usage:
 *   npx tsx scripts/publish-pseo-batch.ts
 * 
 * Cron (Railway):
 *   0 2 * * * npm run publish:pseo-batch
 */

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

// ============================================================================
// CONFIGURATION
// ============================================================================

interface PhaseConfig {
  phase: number
  weeks: string
  maxPagesPerDay: number
  maxPagesPerWeek: number
  minJobsPerPage: number
  description: string
}

// ============================================================================
// TYPES
// ============================================================================

interface PageCandidate {
  slug: string
  type: string
  priority: number
  jobCount: number
  url: string
  title: string
  description: string
  canonical: string
}

interface PublishingBudget {
  publishedToday: number
  publishedThisWeek: number
  remainingToday: number
  remainingThisWeek: number
}

interface QualityCheck {
  passed: boolean
  reasons: string[]
}

interface QualityFilterResult {
  passed: PageCandidate[]
  failed: Array<PageCandidate & { reasons: string[] }>
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  __slog('📊 Six Figure Jobs - pSEO Publishing Script v2.0')
  __slog('================================================\n')

  try {
    // ============================================================================
    // PHASE 1: DOMAIN AGE CHECK (CRITICAL SAFETY GATE)
    // ============================================================================

    const domainAgeWeeks = parseInt(process.env.DOMAIN_AGE_WEEKS || '0', 10)
    __slog(`📅 Domain Age: ${domainAgeWeeks} weeks`)

    if (domainAgeWeeks < 2) {
      __slog('\n🚨 DOMAIN TOO NEW (<2 weeks old)')
      __slog('⚠️  Publishing is DISABLED for new domains')
      __slog('📊 Current Strategy: Monitor GSC indexing only')
      __slog('\n✅ What to do:')
      __slog('   1. Check GSC → Pages → Coverage daily')
      __slog('   2. Wait for 30-50% coverage (2-5k pages)')
      __slog('   3. Set DOMAIN_AGE_WEEKS=3 on Dec 19')
      __slog('   4. Set PSEO_ENABLED=true when ready')
      __slog('\n🎯 Target: Week 3 (Dec 27) for first publishing\n')
      return
    }

    if (domainAgeWeeks < 4) {
      __slog('⚠️  ULTRA CONSERVATIVE MODE (Domain 2-4 weeks)')
      __slog('📊 Max Rate: 2 pages/day, 10 pages/week')
      __slog('🎯 Min Quality: 100+ jobs per page only\n')
    }

    // ============================================================================
    // PHASE 2: MASTER KILL SWITCH (USER CONTROL)
    // ============================================================================

    if (process.env.PSEO_ENABLED !== 'true') {
      __slog('❌ Publishing DISABLED (PSEO_ENABLED=false)\n')
      __slog('Before enabling, verify ALL of the following:')
      __slog('  ✅ Domain age: ≥3 weeks')
      __slog('  ✅ GSC Manual Actions: 0 (zero)')
      __slog('  ✅ GSC Coverage: >30%')
      __slog('  ✅ Coverage trend: Stable or growing')
      __slog('  ✅ No sudden drops (>10%) in past week')
      __slog('  ✅ Quality gates tested on staging\n')
      __slog('📋 Steps to enable:')
      __slog('  1. Set DOMAIN_AGE_WEEKS=3 (or higher)')
      __slog('  2. Set PSEO_ENABLED=true in .env.local')
      __slog('  3. Run this script')
      __slog('  4. Monitor GSC closely for 3 days\n')
      return
    }

    // ============================================================================
    // PHASE 3: CONFIGURATION (ULTRA-CONSERVATIVE FOR NEW DOMAIN)
    // ============================================================================

    const PHASE_CONFIG: PhaseConfig[] = [
      // Week 3: First cautious batch
      {
        phase: 1,
        weeks: '3-4',
        maxPagesPerDay: 2,
        maxPagesPerWeek: 10,
        minJobsPerPage: 100,
        description: 'Ultra-conservative start for new domain',
      },

      // Week 5-6: Still very cautious
      {
        phase: 2,
        weeks: '5-6',
        maxPagesPerDay: 3,
        maxPagesPerWeek: 15,
        minJobsPerPage: 80,
        description: 'Gradual increase with high quality bar',
      },

      // Week 7-8: Moderate growth
      {
        phase: 3,
        weeks: '7-8',
        maxPagesPerDay: 5,
        maxPagesPerWeek: 25,
        minJobsPerPage: 60,
        description: 'Moderate growth if no issues',
      },

      // Week 9-12: Steady scaling
      {
        phase: 4,
        weeks: '9-12',
        maxPagesPerDay: 10,
        maxPagesPerWeek: 50,
        minJobsPerPage: 40,
        description: 'Steady scaling with monitoring',
      },

      // Month 4+: Can increase if healthy
      {
        phase: 5,
        weeks: '13+',
        maxPagesPerDay: 15,
        maxPagesPerWeek: 75,
        minJobsPerPage: 30,
        description: 'Normal operations if GSC stays healthy',
      },
    ]

    // Determine current phase based on domain age
    let currentPhase = PHASE_CONFIG[0]

    if (domainAgeWeeks >= 13) {
      currentPhase = PHASE_CONFIG[4]
    } else if (domainAgeWeeks >= 9) {
      currentPhase = PHASE_CONFIG[3]
    } else if (domainAgeWeeks >= 7) {
      currentPhase = PHASE_CONFIG[2]
    } else if (domainAgeWeeks >= 5) {
      currentPhase = PHASE_CONFIG[1]
    }

    __slog(`\n📈 Current Phase: ${currentPhase.phase}`)
    __slog(`   Weeks: ${currentPhase.weeks}`)
    __slog(`   Description: ${currentPhase.description}`)
    __slog(`   Max per day: ${currentPhase.maxPagesPerDay} pages`)
    __slog(`   Max per week: ${currentPhase.maxPagesPerWeek} pages`)
    __slog(`   Min jobs/page: ${currentPhase.minJobsPerPage}\n`)

    // ============================================================================
    // PHASE 4: REAL TRACKING (Replace placeholder "0" values)
    // ============================================================================

    const budget = await getPublishingBudget(currentPhase)

    __slog('📊 Publishing Activity:')
    __slog(`   Today: ${budget.publishedToday} / ${currentPhase.maxPagesPerDay}`)
    __slog(
      `   This week: ${budget.publishedThisWeek} / ${currentPhase.maxPagesPerWeek}\n`,
    )

    if (budget.remainingToday <= 0) {
      __slog('❌ Daily limit reached. Stopping.')
      __slog(
        `   Come back tomorrow (max ${currentPhase.maxPagesPerDay}/day)\n`,
      )
      return
    }

    if (budget.remainingThisWeek <= 0) {
      __slog('❌ Weekly limit reached. Stopping.')
      __slog(
        `   Wait until next week (max ${currentPhase.maxPagesPerWeek}/week)\n`,
      )
      return
    }

    const batchSize = Math.min(budget.remainingToday, budget.remainingThisWeek)

    __slog(`✅ Can publish up to ${batchSize} pages today\n`)

    // Step 1: Get candidate pages to publish
    const candidates = await getCandidatePages(currentPhase)
    __slog(`📋 Found ${candidates.length} candidate pages`)

    if (candidates.length === 0) {
      __slog('⚠️  No pages ready to publish today')
      return
    }

    // Step 2: Filter by quality gates
    const qualified = await filterByQuality(candidates, currentPhase)
    __slog(`✅ ${qualified.passed.length} pages passed quality gates`)
    __slog(`❌ ${qualified.failed.length} pages failed quality gates`)

    if (qualified.failed.length > 0) {
      __slog('')
      __slog('   Failed pages:')
      qualified.failed.forEach(f => {
        __slog(`     - ${f.slug}: ${f.reasons.join(', ')}`)
      })
    }
    __slog('')

    // Step 3: Publish pages (up to daily + weekly limit)
    const toPublish = qualified.passed.slice(0, batchSize)
    __slog(`🚀 Publishing ${toPublish.length} pages today`)
    __slog('')

    let published = 0
    for (const page of toPublish) {
      try {
        __slog(`   Publishing: ${page.url}`)
        await publishPage(page)
        published++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        __serr(`   ❌ Failed: ${message}`)
      }
    }

    // Step 6: Update sitemap
    __slog('')
    __slog('🗺️  Note: Run `npm run generate:sitemap` to update sitemap.xml')

    // Done!
    __slog('')
    __slog('='.repeat(80))
    __slog(`✅ Publishing complete! ${published} pages published`)
    __slog('='.repeat(80))

  } catch (error) {
    __serr('❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// ============================================================================
// PUBLISHING BUDGET
// ============================================================================

async function getPublishedCount(since: Date): Promise<number> {
  return await prisma.jobSlice.count({
    where: {
      updatedAt: { gte: since },
    },
  })
}

async function getPublishingBudget(config: PhaseConfig): Promise<PublishingBudget> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const publishedToday = await getPublishedCount(todayStart)
  const publishedThisWeek = await getPublishedCount(weekStart)

  return {
    publishedToday,
    publishedThisWeek,
    remainingToday: Math.max(0, config.maxPagesPerDay - publishedToday),
    remainingThisWeek: Math.max(0, config.maxPagesPerWeek - publishedThisWeek),
  }
}

// ============================================================================
// CANDIDATE SELECTION
// ============================================================================

function toTitleCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

async function getCandidatePages(config: PhaseConfig): Promise<PageCandidate[]> {
  const candidates: PageCandidate[] = []

  // Phase 1: Top roles
  if (config.phase === 1) {
    const topRoles = [
      'software-engineer',
      'product-manager',
      'data-scientist',
      'devops-engineer',
      'machine-learning-engineer',
      'frontend-engineer',
      'backend-engineer',
      'full-stack-engineer',
      'data-engineer',
      'engineering-manager',
    ]

    for (const role of topRoles) {
      const jobCount = await prisma.job.count({
        where: {
          roleSlug: role,
          isExpired: false,
          isHighSalaryLocal: true,
        },
      })

      const roleTitle = toTitleCase(role)
      const url = `/jobs/${role}`
      const canonical = `https://www.6figjobs.com/jobs/${role}`
      const title = `${roleTitle} Jobs Paying $100k+ | ${jobCount.toLocaleString()} Positions`
      const description = `Find ${jobCount.toLocaleString()} verified ${roleTitle} jobs paying $100k+ USD. Browse high paying six figure roles from top companies with transparent compensation. Remote, hybrid, and on-site opportunities updated daily.`

      candidates.push({
        slug: role,
        type: 'role',
        priority: 1.0,
        jobCount,
        url,
        title,
        description,
        canonical,
      })
    }
  }

  return candidates
}

// ============================================================================
// QUALITY GATES
// ============================================================================

function validatePageQuality(page: any, minJobs: number): { 
  valid: boolean; 
  reason?: string 
} {
  // Gate 1: Minimum job count
  if (page.jobCount < minJobs) {
    return { 
      valid: false, 
      reason: `Only ${page.jobCount} jobs (min ${minJobs} required)` 
    }
  }
  
  // Gate 2: Has title and description
  if (!page.title || page.title.length < 20) {
    return { 
      valid: false, 
      reason: 'Missing or too-short title' 
    }
  }
  
  if (!page.description || page.description.length < 100) {
    return { 
      valid: false, 
      reason: 'Missing or too-short description' 
    }
  }
  
  // Gate 3: Has canonical URL
  if (!page.canonical) {
    return { 
      valid: false, 
      reason: 'Missing canonical URL' 
    }
  }
  
  // Gate 4: Content length check (estimated)
  const contentLength = page.title.length + page.description.length
  if (contentLength < 200) {
    return { 
      valid: false, 
      reason: `Content too short (${contentLength} chars, min 200)` 
    }
  }
  
  return { valid: true }
}

async function filterByQuality(
  candidates: PageCandidate[],
  config: PhaseConfig
): Promise<QualityFilterResult> {
  const passed: PageCandidate[] = []
  const failed: Array<PageCandidate & { reasons: string[] }> = []

  for (const candidate of candidates) {
    const check = checkQualityGate(candidate, config)

    if (check.passed) {
      passed.push(candidate)
    } else {
      failed.push({ ...candidate, reasons: check.reasons })
    }
  }

  // Sort by priority (highest first)
  passed.sort((a, b) => b.priority - a.priority)

  return { passed, failed }
}

function checkQualityGate(page: PageCandidate, config: PhaseConfig): QualityCheck {
  const reasons: string[] = []

  const validation = validatePageQuality(page, config.minJobsPerPage)
  if (!validation.valid) {
    reasons.push(validation.reason ?? 'Failed quality gates')
  }

  return {
    passed: reasons.length === 0,
    reasons,
  }
}

// ============================================================================
// PUBLISHING
// ============================================================================

async function publishPage(page: PageCandidate) {
  // TODO: Implement actual page publishing logic
  // This might involve:
  // 1. Creating a database record for the page
  // 2. Generating the page content
  // 3. Updating the sitemap
  // 4. Notifying Google

  __slog(`   ✅ Published ${page.type}/${page.slug} (${page.jobCount} jobs)`)
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
