// scripts/backfillJobLogos.ts

/**
 * Bulk logo backfill:
 * Copies company.logoUrl → job.companyLogo
 * for any job missing logo.
 *
 * Run with:  npx ts-node scripts/backfillJobLogos.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting job logo backfill…')

  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { companyLogo: null },
        { companyLogo: '' },
      ],
    },
    include: { companyRef: true },
  })

  console.log(`Found ${jobs.length} jobs missing logo…`)

  let updated = 0

  for (const job of jobs) {
    const logo = job.companyRef?.logoUrl
    if (!logo) continue

    await prisma.job.update({
      where: { id: job.id },
      data: { companyLogo: logo },
    })

    updated++
  }

  console.log(`✅ Updated ${updated} job logos.`)
  console.log('🎉 Backfill complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
