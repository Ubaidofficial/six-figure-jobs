// scripts/mergeDuplicates.ts
// Identify and merge duplicate jobs based on dedupeKey
//
// Run with: npx ts-node scripts/mergeDuplicates.ts
// 
// Options:
//   --dry-run    Show what would be merged without making changes
//   --verbose    Show detailed info for each duplicate group
//
// This script:
// 1. Finds all jobs sharing the same dedupeKey
// 2. Keeps the job with the highest source priority
// 3. Marks lower-priority duplicates as expired
// 4. Preserves the best data from each source

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// Configuration
// =============================================================================

const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

// =============================================================================
// Types
// =============================================================================

interface DuplicateGroup {
  dedupeKey: string
  companyId: string
  jobs: {
    id: string
    title: string
    source: string
    sourcePriority: number
    isExpired: boolean
    createdAt: Date
    salaryMin: bigint | null
    salaryMax: bigint | null
    url: string | null
  }[]
}

// =============================================================================
// Main Script
// =============================================================================

async function mergeDuplicates() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Merge Duplicate Jobs')
  if (DRY_RUN) {
    console.log('  🔍 DRY RUN MODE - No changes will be made')
  }
  console.log('═══════════════════════════════════════════════')
  console.log('')

  // Find all dedupe keys that have multiple active jobs
  const duplicateKeys = await prisma.$queryRaw<{ dedupeKey: string; companyId: string; count: bigint }[]>`
    SELECT "dedupeKey", "companyId", COUNT(*) as count
    FROM "Job"
    WHERE "dedupeKey" IS NOT NULL
      AND "isExpired" = false
    GROUP BY "dedupeKey", "companyId"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `

  console.log(`Found ${duplicateKeys.length} duplicate groups`)
  console.log('')

  if (duplicateKeys.length === 0) {
    console.log('✅ No duplicates to merge!')
    return
  }

  let totalMerged = 0
  let totalKept = 0
  let totalErrors = 0

  for (const dupKey of duplicateKeys) {
    // Get all jobs with this dedupe key
    const jobs = await prisma.job.findMany({
      where: {
        dedupeKey: dupKey.dedupeKey,
        companyId: dupKey.companyId,
        isExpired: false,
      },
      select: {
        id: true,
        title: true,
        source: true,
        sourcePriority: true,
        isExpired: true,
        createdAt: true,
        salaryMin: true,
        salaryMax: true,
        url: true,
        minAnnual: true,
        maxAnnual: true,
        descriptionHtml: true,
      },
      orderBy: [
        { sourcePriority: 'desc' },
        { createdAt: 'asc' }, // Oldest first among same priority
      ],
    })

    if (jobs.length < 2) continue

    // The winner is the job with highest priority (first in sorted list)
    const winner = jobs[0]
    const losers = jobs.slice(1)

    if (VERBOSE) {
      console.log('─'.repeat(60))
      console.log(`Dedupe Key: ${dupKey.dedupeKey.slice(0, 50)}...`)
      console.log(`Jobs: ${jobs.length}`)
      console.log('')
      console.log(`  KEEP: ${winner.id}`)
      console.log(`        Source: ${winner.source} (priority: ${winner.sourcePriority})`)
      console.log(`        Title: ${winner.title.slice(0, 50)}`)
      console.log('')
      for (const loser of losers) {
        console.log(`  EXPIRE: ${loser.id}`)
        console.log(`          Source: ${loser.source} (priority: ${loser.sourcePriority})`)
      }
      console.log('')
    }

    if (!DRY_RUN) {
      try {
        // Check if any loser has better salary data we should preserve
        let bestSalaryMin = winner.salaryMin
        let bestSalaryMax = winner.salaryMax
        let bestMinAnnual = winner.minAnnual
        let bestMaxAnnual = winner.maxAnnual
        let bestDescription = winner.descriptionHtml

        for (const loser of losers) {
          // If winner has no salary but loser does, take loser's salary
          if (bestSalaryMin === null && loser.salaryMin !== null) {
            bestSalaryMin = loser.salaryMin
          }
          if (bestSalaryMax === null && loser.salaryMax !== null) {
            bestSalaryMax = loser.salaryMax
          }
          if (bestMinAnnual === null && loser.minAnnual !== null) {
            bestMinAnnual = loser.minAnnual
          }
          if (bestMaxAnnual === null && loser.maxAnnual !== null) {
            bestMaxAnnual = loser.maxAnnual
          }
          // If winner has no description but loser does, take loser's
          if (!bestDescription && loser.descriptionHtml) {
            bestDescription = loser.descriptionHtml
          }
        }

        // Update winner with best data if needed
        const updateData: any = {}
        if (bestSalaryMin !== winner.salaryMin) updateData.salaryMin = bestSalaryMin
        if (bestSalaryMax !== winner.salaryMax) updateData.salaryMax = bestSalaryMax
        if (bestMinAnnual !== winner.minAnnual) updateData.minAnnual = bestMinAnnual
        if (bestMaxAnnual !== winner.maxAnnual) updateData.maxAnnual = bestMaxAnnual
        if (bestDescription !== winner.descriptionHtml) updateData.descriptionHtml = bestDescription

        if (Object.keys(updateData).length > 0) {
          await prisma.job.update({
            where: { id: winner.id },
            data: updateData,
          })
          if (VERBOSE) {
            console.log(`  Enhanced winner with data from duplicates`)
          }
        }

        // Mark losers as expired
        await prisma.job.updateMany({
          where: {
            id: { in: losers.map(l => l.id) },
          },
          data: {
            isExpired: true,
            // Add a note about why it was expired
            // mergedIntoId: winner.id, // If you have this field
          },
        })

        totalKept++
        totalMerged += losers.length

      } catch (err: any) {
        console.error(`Error merging group ${dupKey.dedupeKey}: ${err.message}`)
        totalErrors++
      }
    } else {
      // Dry run - just count
      totalKept++
      totalMerged += losers.length
    }
  }

  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('  Results')
  console.log('═══════════════════════════════════════════════')
  console.log(`  Duplicate groups: ${duplicateKeys.length}`)
  console.log(`  Jobs kept: ${totalKept}`)
  console.log(`  Jobs ${DRY_RUN ? 'would be ' : ''}merged/expired: ${totalMerged}`)
  if (totalErrors > 0) {
    console.log(`  Errors: ${totalErrors}`)
  }
  console.log('')

  if (DRY_RUN) {
    console.log('This was a dry run. Run without --dry-run to apply changes.')
  } else {
    console.log('✅ Merge complete!')
  }
}

// =============================================================================
// Additional Analysis
// =============================================================================

async function analyzeSourceDistribution() {
  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('  Source Distribution Analysis')
  console.log('═══════════════════════════════════════════════')
  console.log('')

  const distribution = await prisma.$queryRaw<{ source: string; count: bigint; expired: bigint }[]>`
    SELECT 
      source,
      COUNT(*) as count,
      SUM(CASE WHEN "isExpired" = true THEN 1 ELSE 0 END) as expired
    FROM "Job"
    GROUP BY source
    ORDER BY count DESC
  `

  console.log('  Source                          | Active | Expired | Total')
  console.log('  ' + '-'.repeat(65))

  for (const row of distribution) {
    const total = Number(row.count)
    const expired = Number(row.expired)
    const active = total - expired
    const source = (row.source || 'unknown').padEnd(30)
    console.log(`  ${source} | ${String(active).padStart(6)} | ${String(expired).padStart(7)} | ${String(total).padStart(5)}`)
  }

  console.log('')
}

// Run
async function main() {
  await mergeDuplicates()
  await analyzeSourceDistribution()
}

main()
  .catch((err) => {
    console.error('Script failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })