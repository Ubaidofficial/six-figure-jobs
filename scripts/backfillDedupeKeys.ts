// scripts/backfillDedupeKeys.ts
// Backfill dedupeKey field for all existing jobs
//
// Run with: npx ts-node scripts/backfillDedupeKeys.ts
//
// This script:
// 1. Finds all jobs without a dedupeKey
// 2. Generates dedupe keys using the same algorithm as the ingest layer
// 3. Updates jobs in batches
// 4. Reports on any potential duplicates found

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// Dedupe Key Generation (same as lib/ingest/dedupeHelpers.ts)
// =============================================================================

/**
 * Normalize job title for deduplication.
 * - Lowercase
 * - Remove work-mode indicators (remote, hybrid, etc.)
 * - Expand common abbreviations
 * - Collapse whitespace
 * 
 * IMPORTANT: Does NOT strip seniority levels (Senior, Staff, etc.)
 */
function normalizeTitle(title: string): string {
  if (!title) return ''
  
  return title
    .toLowerCase()
    // Remove work-mode indicators that don't define the role
    .replace(/\b(remote|hybrid|onsite|on-site|work from home|wfh)\b/gi, '')
    // Expand common abbreviations
    .replace(/\bsr\.?\s*/gi, 'senior ')
    .replace(/\bjr\.?\s*/gi, 'junior ')
    .replace(/\beng\.?\s*/gi, 'engineer ')
    .replace(/\bmgr\.?\s*/gi, 'manager ')
    .replace(/\bdev\.?\s*/gi, 'developer ')
    // Remove special characters but keep alphanumeric
    .replace(/[^a-z0-9\s]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalize location for deduplication.
 * - Remove generic "remote" indicators
 * - Normalize punctuation
 */
function normalizeLocation(loc: string | null | undefined): string {
  if (!loc) return ''
  
  return loc
    .toLowerCase()
    // Remove generic remote indicators
    .replace(/\b(remote|anywhere|worldwide|global|work from home|wfh)\b/gi, '')
    // Remove flag emojis (they're nice for display but bad for matching)
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    // Normalize punctuation
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Create a deterministic dedupe key for a job.
 * Format: "{companyId}::{normalizedTitle}::{normalizedLocation}"
 */
function makeJobDedupeKey(
  companyId: string,
  title: string,
  location: string | null | undefined
): string {
  const normTitle = normalizeTitle(title)
  const normLoc = normalizeLocation(location)
  return `${companyId}::${normTitle}::${normLoc}`
}

// =============================================================================
// Main Script
// =============================================================================

const BATCH_SIZE = 100

async function backfillDedupeKeys() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Backfill Dedupe Keys')
  console.log('═══════════════════════════════════════════════')
  console.log('')

  // Count jobs without dedupe key
  const totalWithoutKey = await prisma.job.count({
    where: { dedupeKey: null },
  })

  const totalJobs = await prisma.job.count()

  console.log(`Total jobs: ${totalJobs}`)
  console.log(`Jobs without dedupeKey: ${totalWithoutKey}`)
  console.log('')

  if (totalWithoutKey === 0) {
    console.log('✅ All jobs already have dedupe keys!')
    return
  }

  console.log(`Processing ${totalWithoutKey} jobs in batches of ${BATCH_SIZE}...`)
  console.log('')

  let processed = 0
  let updated = 0
  let errors = 0
  const dedupeKeyCount = new Map<string, string[]>() // key -> [jobIds]

  // Process in batches
  while (processed < totalWithoutKey) {
    const jobs = await prisma.job.findMany({
      where: { dedupeKey: null },
      select: {
        id: true,
        title: true,
        companyId: true,
        locationRaw: true,
        city: true,
        source: true,
      },
      take: BATCH_SIZE,
    })

    if (jobs.length === 0) break

    for (const job of jobs) {
      try {
        // Use locationRaw or city for location
        const locationText = job.locationRaw || job.city || ''
        
        // Generate dedupe key
        const dedupeKey = makeJobDedupeKey(
          job.companyId || 'unknown',
          job.title,
          locationText
        )

        // Track for duplicate detection
        if (!dedupeKeyCount.has(dedupeKey)) {
          dedupeKeyCount.set(dedupeKey, [])
        }
        dedupeKeyCount.get(dedupeKey)!.push(job.id)

        // Determine source priority
        let sourcePriority = 20 // default
        if (job.source?.startsWith('ats:')) {
          sourcePriority = 100
        } else if (job.source?.startsWith('company:')) {
          sourcePriority = 90
        } else if (job.source?.includes('remote100k') || job.source?.includes('remoterocketship')) {
          sourcePriority = 50
        } else if (job.source?.includes('remoteok') || job.source?.includes('remotive') || job.source?.includes('remoteai')) {
          sourcePriority = 40
        } else if (job.source?.startsWith('board:')) {
          sourcePriority = 30
        }

        // Update job
        await prisma.job.update({
          where: { id: job.id },
          data: {
            dedupeKey,
            sourcePriority,
          },
        })

        updated++
      } catch (err: any) {
        console.error(`  Error updating job ${job.id}: ${err.message}`)
        errors++
      }
    }

    processed += jobs.length
    const percent = Math.round((processed / totalWithoutKey) * 100)
    console.log(`  Progress: ${processed}/${totalWithoutKey} (${percent}%) - ${updated} updated, ${errors} errors`)
  }

  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('  Results')
  console.log('═══════════════════════════════════════════════')
  console.log(`  Jobs processed: ${processed}`)
  console.log(`  Jobs updated: ${updated}`)
  console.log(`  Errors: ${errors}`)
  console.log('')

  // Find duplicates
  const duplicates: { key: string; jobIds: string[] }[] = []
  for (const [key, jobIds] of dedupeKeyCount.entries()) {
    if (jobIds.length > 1) {
      duplicates.push({ key, jobIds })
    }
  }

  if (duplicates.length > 0) {
    console.log('═══════════════════════════════════════════════')
    console.log('  ⚠️  Potential Duplicates Found')
    console.log('═══════════════════════════════════════════════')
    console.log(`  Found ${duplicates.length} dedupe keys with multiple jobs`)
    console.log('')

    // Show first 10 duplicates
    const samplesToShow = duplicates.slice(0, 10)
    for (const dup of samplesToShow) {
      console.log(`  Key: ${dup.key.slice(0, 60)}...`)
      console.log(`  Jobs: ${dup.jobIds.length}`)
      for (const jobId of dup.jobIds.slice(0, 3)) {
        console.log(`    - ${jobId}`)
      }
      if (dup.jobIds.length > 3) {
        console.log(`    ... and ${dup.jobIds.length - 3} more`)
      }
      console.log('')
    }

    if (duplicates.length > 10) {
      console.log(`  ... and ${duplicates.length - 10} more duplicate groups`)
    }

    console.log('')
    console.log('  Run scripts/mergeDuplicates.ts to merge these duplicates')
  } else {
    console.log('✅ No duplicates found!')
  }

  console.log('')
  console.log('Done!')
}

// Run
backfillDedupeKeys()
  .catch((err) => {
    console.error('Script failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })