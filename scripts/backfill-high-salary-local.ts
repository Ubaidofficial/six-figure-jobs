// scripts/backfill-high-salary-local.ts
/**
 * Backfill isHighSalaryLocal field for existing jobs
 * 
 * This script:
 * 1. Fetches all jobs with minAnnual and countryCode
 * 2. Checks if they meet PPP-adjusted thresholds
 * 3. Updates isHighSalaryLocal and isHundredKLocal accordingly
 */

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { getMinSalaryForCountry, isVeryHighSalary } from '../lib/jobs/salaryThresholds'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

async function backfillHighSalaryLocal() {
  __slog('🚀 Starting backfill for isHighSalaryLocal...')
  __slog('')

  try {
    // Get all jobs with salary data
    const jobs = await prisma.job.findMany({
      where: {
        minAnnual: { not: null },
        countryCode: { not: null },
      },
      select: {
        id: true,
        minAnnual: true,
        countryCode: true,
        isHighSalaryLocal: true,
        isHundredKLocal: true,
      },
    })

    __slog(`📊 Found ${jobs.length.toLocaleString()} jobs to process`)
    __slog('')

    let updated = 0
    let alreadyCorrect = 0
    let noThreshold = 0
    const batchSize = 1000

    // Process in batches
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize)
      
      const updates = batch
        .map((job) => {
          if (!job.minAnnual || !job.countryCode) return null

          const minAnnual = Number(job.minAnnual)
          const countryCode = job.countryCode.toUpperCase()
          
          // Get threshold for this country
          const threshold = getMinSalaryForCountry(countryCode)
          if (threshold == null) {
            noThreshold++
            return null
          }

          // Calculate new values
          const newIsHundredKLocal = minAnnual >= threshold
          const newIsHighSalaryLocal = isVeryHighSalary(minAnnual, countryCode)

          // Check if update needed
          if (
            job.isHundredKLocal === newIsHundredKLocal &&
            job.isHighSalaryLocal === newIsHighSalaryLocal
          ) {
            alreadyCorrect++
            return null
          }

          return {
            id: job.id,
            isHundredKLocal: newIsHundredKLocal,
            isHighSalaryLocal: newIsHighSalaryLocal,
          }
        })
        .filter((update): update is { id: string; isHundredKLocal: boolean; isHighSalaryLocal: boolean } => update !== null)

      // Batch update
      if (updates.length > 0) {
        await Promise.all(
          updates.map((update) =>
            prisma.job.update({
              where: { id: update.id },
              data: {
                isHundredKLocal: update.isHundredKLocal,
                isHighSalaryLocal: update.isHighSalaryLocal,
              },
            })
          )
        )
        updated += updates.length
      }

      // Progress indicator
      const progress = Math.min(i + batchSize, jobs.length)
      const percentage = ((progress / jobs.length) * 100).toFixed(1)
      __slog(`Progress: ${progress.toLocaleString()}/${jobs.length.toLocaleString()} (${percentage}%)`)
    }

    __slog('')
    __slog('✅ Backfill complete!')
    __slog('')
    __slog('📈 Summary:')
    __slog(`  • Total jobs processed: ${jobs.length.toLocaleString()}`)
    __slog(`  • Jobs updated: ${updated.toLocaleString()}`)
    __slog(`  • Already correct: ${alreadyCorrect.toLocaleString()}`)
    __slog(`  • No threshold found: ${noThreshold.toLocaleString()}`)
    __slog('')

  } catch (error) {
    __serr('❌ Error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the backfill
backfillHighSalaryLocal()
  .then(() => {
    __slog('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    __serr('❌ Script failed:', error)
    process.exit(1)
  })
