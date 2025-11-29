// scripts/normalizeLocations.ts

/**
 * Very simple location normalizer:
 * - Marks jobs as remote if locationRaw mentions "remote"
 * - Backfills citySlug from city
 * - Uppercases countryCode
 *
 * This is intentionally conservative so it can't really break things.
 *
 * Run with:
 *   npx ts-node scripts/normalizeLocations.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function main() {
  console.log('🚀 Normalizing locations…')

  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
    },
    select: {
      id: true,
      city: true,
      citySlug: true,
      countryCode: true,
      locationRaw: true,
      remote: true,
    },
  })

  console.log(`Checking ${jobs.length} jobs…`)

  let updated = 0

  for (const job of jobs) {
    const data: any = {}

    // Remote detection from locationRaw (non-destructive)
    if (job.locationRaw) {
      const raw = job.locationRaw.toLowerCase()
      if (
        raw.includes('remote') &&
        job.remote !== true // don't overwrite explicit flags
      ) {
        data.remote = true
      }
    }

    // City slug from city
    if (job.city && !job.citySlug) {
      data.citySlug = slugify(job.city)
    }

    // Country code uppercase
    if (job.countryCode && job.countryCode !== job.countryCode.toUpperCase()) {
      data.countryCode = job.countryCode.toUpperCase()
    }

    if (Object.keys(data).length === 0) continue

    await prisma.job.update({
      where: { id: job.id },
      data,
    })
    updated++
  }

  console.log(`✅ Updated ${updated} jobs with normalized locations.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
