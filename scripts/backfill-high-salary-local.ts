// scripts/backfill-high-salary-local.ts
/**
 * Backfill isHighSalaryLocal field for existing jobs
 * 
 * This script:
 * 1. Fetches all jobs with minAnnual and countryCode
 * 2. Checks if they meet PPP-adjusted thresholds
 * 3. Updates isHighSalaryLocal and isHundredKLocal accordingly
 */

import { PrismaClient } from '@prisma/client'
import { getMinSalaryForCountry, isVeryHighSalary } from '../lib/jobs/salaryThresholds'

const prisma = new PrismaClient()

async function backfillHighSalaryLocal() {
  console.log('🚀 Starting backfill for isHighSalaryLocal...')
  console.log('')

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

    console.log(`📊 Found ${jobs.length.toLocaleString()} jobs to process`)
    console.log('')

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
          if (!threshold) {
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
      console.log(`Progress: ${progress.toLocaleString()}/${jobs.length.toLocaleString()} (${percentage}%)`)
    }

    console.log('')
    console.log('✅ Backfill complete!')
    console.log('')
    console.log('📈 Summary:')
    console.log(`  • Total jobs processed: ${jobs.length.toLocaleString()}`)
    console.log(`  • Jobs updated: ${updated.toLocaleString()}`)
    console.log(`  • Already correct: ${alreadyCorrect.toLocaleString()}`)
    console.log(`  • No threshold found: ${noThreshold.toLocaleString()}`)
    console.log('')

  } catch (error) {
    console.error('❌ Error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the backfill
backfillHighSalaryLocal()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })