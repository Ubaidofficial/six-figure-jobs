// scripts/testLocationNormalizer.ts

import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'
import { normalizeLocation } from '../lib/normalizers/location'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function main() {
  __slog('✨ Sample normalized locations:\n')

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

    __slog('────────────────────────────────────────')
    __slog(`Job ID   : ${job.id}`)
    __slog(`Title    : ${job.title}`)
    __slog(`RAW      : ${job.locationRaw}`)
    __slog('NORM     :', normalized)
    __slog(
      'Flags    :',
      `remote=${job.remote}  remoteMode=${job.remoteMode}  countryCode=${job.countryCode}`
    )
  }

  __slog('\n✅ Done.\n')
  await prisma.$disconnect()
}

main().catch((err) => {
  __serr('Error in testLocationNormalizer:', err)
  prisma.$disconnect().finally(() => process.exit(1))
})
