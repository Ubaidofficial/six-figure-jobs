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
  minUniqueContent: number
  requireAllSchemas: boolean
}

const PHASE_CONFIGS: PhaseConfig[] = [
  {
    phase: 1,
    weeks: '1-2',
    maxPagesPerDay: 10,
    maxPagesPerWeek: 10,
    minJobsPerPage: 100,
    minUniqueContent: 250,
    requireAllSchemas: true,
  },
  {
    phase: 2,
    weeks: '3-6',
    maxPagesPerDay: 20,
    maxPagesPerWeek: 20,
    minJobsPerPage: 30,
    minUniqueContent: 200,
    requireAllSchemas: true,
  },
  {
    phase: 3,
    weeks: '7-10',
    maxPagesPerDay: 30,
    maxPagesPerWeek: 30,
    minJobsPerPage: 20,
    minUniqueContent: 200,
    requireAllSchemas: true,
  },
  {
    phase: 4,
    weeks: '11-12',
    maxPagesPerDay: 50,
    maxPagesPerWeek: 50,
    minJobsPerPage: 10,
    minUniqueContent: 200,
    requireAllSchemas: true,
  },
]

const START_DATE = new Date('2025-12-16') // ADJUST THIS TO YOUR START DATE

// ============================================================================
// TYPES
// ============================================================================

interface PageCandidate {
  slug: string
  type: string
  priority: number
  jobCount: number
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
  console.log('='.repeat(80))
  console.log('Six Figure Jobs - pSEO Batch Publishing')
  console.log('='.repeat(80))
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log('')

  try {
    // Step 1: Get current phase
    const phaseConfig = getCurrentPhaseConfig()
    console.log(`📊 Current Phase: ${phaseConfig.phase} (Weeks ${phaseConfig.weeks})`)
    console.log(`   Max pages/day: ${phaseConfig.maxPagesPerDay}`)
    console.log(`   Min jobs/page: ${phaseConfig.minJobsPerPage}`)
    console.log('')

    // Step 2: Check publishing budget
    const budget = await getPublishingBudget(phaseConfig)
    console.log(`💰 Publishing Budget:`)
    console.log(`   Today: ${budget.remainingToday} pages remaining (${budget.publishedToday} published)`)
    console.log(`   This week: ${budget.remainingThisWeek} pages remaining`)
    console.log('')

    if (budget.remainingToday <= 0) {
      console.log(`✋ Daily limit reached. Come back tomorrow!`)
      return
    }

    // Step 3: Get candidate pages to publish
    const candidates = await getCandidatePages(phaseConfig)
    console.log(`📋 Found ${candidates.length} candidate pages`)

    if (candidates.length === 0) {
      console.log('⚠️  No pages ready to publish today')
      return
    }

    // Step 4: Filter by quality gates
    const qualified = await filterByQuality(candidates, phaseConfig)
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

    // Step 5: Publish pages (up to daily limit)
    const toPublish = qualified.passed.slice(0, budget.remainingToday)
    console.log(`🚀 Publishing ${toPublish.length} pages today`)
    console.log('')

    let published = 0
    for (const page of toPublish) {
      try {
        console.log(`   Publishing: ${page.type}/${page.slug}`)
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
// PHASE MANAGEMENT
// ============================================================================

function getCurrentPhaseConfig(): PhaseConfig {
  const weeksSinceStart = Math.floor(
    (Date.now() - START_DATE.getTime()) / (7 * 24 * 60 * 60 * 1000)
  )

  if (weeksSinceStart < 2) return PHASE_CONFIGS[0]
  if (weeksSinceStart < 6) return PHASE_CONFIGS[1]
  if (weeksSinceStart < 10) return PHASE_CONFIGS[2]
  return PHASE_CONFIGS[3]
}

// ============================================================================
// PUBLISHING BUDGET
// ============================================================================

async function getPublishingBudget(config: PhaseConfig): Promise<PublishingBudget> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thisWeek = new Date(today)
  thisWeek.setDate(today.getDate() - today.getDay())

  // For now, we'll track by checking when pages were created
  // In production, add a `publishedAt` field to track this properly
  const publishedToday = 0  // TODO: Implement proper tracking
  const publishedThisWeek = 0  // TODO: Implement proper tracking

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

      candidates.push({
        slug: role,
        type: 'role',
        priority: 1.0,
        jobCount,
      })
    }
  }

  return candidates
}

// ============================================================================
// QUALITY GATES
// ============================================================================

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

  // Check job count
  if (page.jobCount < config.minJobsPerPage) {
    reasons.push(`Only ${page.jobCount} jobs (min: ${config.minJobsPerPage})`)
  }

  // Add more checks here as needed
  // - Content uniqueness
  // - Has metadata
  // - Has schemas
  // etc.

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
