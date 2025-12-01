// scripts/backfillRemoteCountry.ts
// Fill countryCode for remote jobs when missing, using remoteRegion/locationRaw hints.
// Usage: npx tsx scripts/backfillRemoteCountry.ts

import { prisma } from '../lib/prisma'

const REGION_COUNTRY_MAP: Record<string, string> = {
  'us-only': 'US',
  us: 'US',
  usa: 'US',
  canada: 'CA',
  can: 'CA',
  uk: 'GB',
  'united kingdom': 'GB',
  ireland: 'IE',
  emea: 'GB', // fallback
  apac: 'SG', // fallback
}

function inferCountryFromLocation(location?: string | null): string | null {
  if (!location) return null
  const lc = location.toLowerCase()
  for (const [key, cc] of Object.entries(REGION_COUNTRY_MAP)) {
    if (lc.includes(key)) return cc
  }
  return null
}

async function main() {
  const batchSize = 500
  let skip = 0
  let totalUpdated = 0

  while (true) {
    const jobs = await prisma.job.findMany({
      where: {
        isExpired: false,
        countryCode: null,
        OR: [{ remote: true }, { remoteMode: 'remote' }, { remoteRegion: { not: null } }],
      },
      select: {
        id: true,
        remoteRegion: true,
        locationRaw: true,
      },
      skip,
      take: batchSize,
    })

    if (jobs.length === 0) break
    console.log(`Batch starting at ${skip}: ${jobs.length} jobs`)

    for (const job of jobs) {
      const byRegion = job.remoteRegion ? REGION_COUNTRY_MAP[job.remoteRegion.toLowerCase()] : null
      const byLocation = inferCountryFromLocation(job.locationRaw)
      const cc = byRegion || byLocation
      if (!cc) continue

      await prisma.job.update({
        where: { id: job.id },
        data: { countryCode: cc },
      })
      totalUpdated++
    }

    skip += batchSize
  }

  console.log(`Updated ${totalUpdated} jobs with inferred countryCode.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
