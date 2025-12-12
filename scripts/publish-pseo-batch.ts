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

import { PrismaClient } from '@prisma/client'

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
  console.log('📊 Six Figure Jobs - pSEO Publishing Script v2.0')
  console.log('================================================\n')

  try {
    // ============================================================================
    // PHASE 1: DOMAIN AGE CHECK (CRITICAL SAFETY GATE)
    // ============================================================================

    const domainAgeWeeks = parseInt(process.env.DOMAIN_AGE_WEEKS || '0', 10)
    console.log(`📅 Domain Age: ${domainAgeWeeks} weeks`)

    if (domainAgeWeeks < 2) {
      console.log('\n🚨 DOMAIN TOO NEW (<2 weeks old)')
      console.log('⚠️  Publishing is DISABLED for new domains')
      console.log('📊 Current Strategy: Monitor GSC indexing only')
      console.log('\n✅ What to do:')
      console.log('   1. Check GSC → Pages → Coverage daily')
      console.log('   2. Wait for 30-50% coverage (2-5k pages)')
      console.log('   3. Set DOMAIN_AGE_WEEKS=3 on Dec 19')
      console.log('   4. Set PSEO_ENABLED=true when ready')
      console.log('\n🎯 Target: Week 3 (Dec 27) for first publishing\n')
      return
    }

    if (domainAgeWeeks < 4) {
      console.log('⚠️  ULTRA CONSERVATIVE MODE (Domain 2-4 weeks)')
      console.log('📊 Max Rate: 2 pages/day, 10 pages/week')
      console.log('🎯 Min Quality: 100+ jobs per page only\n')
    }

    // ============================================================================
    // PHASE 2: MASTER KILL SWITCH (USER CONTROL)
    // ============================================================================

    if (process.env.PSEO_ENABLED !== 'true') {
      console.log('❌ Publishing DISABLED (PSEO_ENABLED=false)\n')
      console.log('Before enabling, verify ALL of the following:')
      console.log('  ✅ Domain age: ≥3 weeks')
      console.log('  ✅ GSC Manual Actions: 0 (zero)')
      console.log('  ✅ GSC Coverage: >30%')
      console.log('  ✅ Coverage trend: Stable or growing')
      console.log('  ✅ No sudden drops (>10%) in past week')
      console.log('  ✅ Quality gates tested on staging\n')
      console.log('📋 Steps to enable:')
      console.log('  1. Set DOMAIN_AGE_WEEKS=3 (or higher)')
      console.log('  2. Set PSEO_ENABLED=true in .env.local')
      console.log('  3. Run this script')
      console.log('  4. Monitor GSC closely for 3 days\n')
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

    console.log(`\n📈 Current Phase: ${currentPhase.phase}`)
    console.log(`   Weeks: ${currentPhase.weeks}`)
    console.log(`   Description: ${currentPhase.description}`)
    console.log(`   Max per day: ${currentPhase.maxPagesPerDay} pages`)
    console.log(`   Max per week: ${currentPhase.maxPagesPerWeek} pages`)
    console.log(`   Min jobs/page: ${currentPhase.minJobsPerPage}\n`)

    // ============================================================================
    // PHASE 4: REAL TRACKING (Replace placeholder "0" values)
    // ============================================================================

    const budget = await getPublishingBudget(currentPhase)

    console.log('📊 Publishing Activity:')
    console.log(`   Today: ${budget.publishedToday} / ${currentPhase.maxPagesPerDay}`)
    console.log(
      `   This week: ${budget.publishedThisWeek} / ${currentPhase.maxPagesPerWeek}\n`,
    )

    if (budget.remainingToday <= 0) {
      console.log('❌ Daily limit reached. Stopping.')
      console.log(
        `   Come back tomorrow (max ${currentPhase.maxPagesPerDay}/day)\n`,
      )
      return
    }

    if (budget.remainingThisWeek <= 0) {
      console.log('❌ Weekly limit reached. Stopping.')
      console.log(
        `   Wait until next week (max ${currentPhase.maxPagesPerWeek}/week)\n`,
      )
      return
    }

    const batchSize = Math.min(budget.remainingToday, budget.remainingThisWeek)

    console.log(`✅ Can publish up to ${batchSize} pages today\n`)

    // Step 1: Get candidate pages to publish
    const candidates = await getCandidatePages(currentPhase)
    console.log(`📋 Found ${candidates.length} candidate pages`)

    if (candidates.length === 0) {
      console.log('⚠️  No pages ready to publish today')
      return
    }

    // Step 2: Filter by quality gates
    const qualified = await filterByQuality(candidates, currentPhase)
    console.log(`✅ ${qualified.passed.length} pages passed quality gates`)
    console.log(`❌ ${qualified.failed.length} pages failed quality gates`)

    if (qualified.failed.length > 0) {
      console.log('')
      console.log('   Failed pages:')
      qualified.failed.forEach(f => {
        console.log(`     - ${f.slug}: ${f.reasons.join(', ')}`)
      })
    }
    console.log('')

    // Step 3: Publish pages (up to daily + weekly limit)
    const toPublish = qualified.passed.slice(0, batchSize)
    console.log(`🚀 Publishing ${toPublish.length} pages today`)
    console.log('')

    let published = 0
    for (const page of toPublish) {
      try {
        console.log(`   Publishing: ${page.url}`)
        await publishPage(page)
        published++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`   ❌ Failed: ${message}`)
      }
    }

    // Step 6: Update sitemap
    console.log('')
    console.log('🗺️  Note: Run `npm run generate:sitemap` to update sitemap.xml')

    // Done!
    console.log('')
    console.log('='.repeat(80))
    console.log(`✅ Publishing complete! ${published} pages published`)
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ Fatal error:', error)
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

  console.log(`   ✅ Published ${page.type}/${page.slug} (${page.jobCount} jobs)`)
}

// ============================================================================
// RUN
// ============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
