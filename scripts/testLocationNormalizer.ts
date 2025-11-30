// scripts/testLocationNormalizer.ts

import { prisma } from '../lib/prisma'
import { normalizeLocation } from '../lib/normalizers/location'

async function main() {
  console.log('✨ Sample normalized locations:\n')

  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      locationRaw: true,
      countryCode: true,
      remote: true,
      remoteMode: true,
    },
    take: 15,
  })

  for (const job of jobs) {
    const normalized = normalizeLocation(job.locationRaw)

    console.log('────────────────────────────────────────')
    console.log(`Job ID   : ${job.id}`)
    console.log(`Title    : ${job.title}`)
    console.log(`RAW      : ${job.locationRaw}`)
    console.log('NORM     :', normalized)
    console.log(
      'Flags    :',
      `remote=${job.remote}  remoteMode=${job.remoteMode}  countryCode=${job.countryCode}`
    )
  }

  console.log('\n✅ Done.\n')
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Error in testLocationNormalizer:', err)
  prisma.$disconnect().finally(() => process.exit(1))
})
