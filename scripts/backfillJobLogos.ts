// scripts/backfillJobLogos.ts

/**
 * Bulk logo backfill:
 * Copies company.logoUrl → job.companyLogo
 * for any job missing logo.
 *
 * Run with:  npx ts-node scripts/backfillJobLogos.ts
 */

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

async function main() {
  __slog('🚀 Starting job logo backfill…')

  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { companyLogo: null },
        { companyLogo: '' },
      ],
    },
    include: { companyRef: true },
  })

  __slog(`Found ${jobs.length} jobs missing logo…`)

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

  __slog(`✅ Updated ${updated} job logos.`)
  __slog('🎉 Backfill complete.')
}

main()
  .catch((e) => {
    __serr(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
