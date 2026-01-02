import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'
import { CANONICAL_ROLE_SLUGS } from '../lib/roles/canonicalSlugs'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function run() {
  __slog('Starting cleanup of non-canonical role slugs...')

  const result = await prisma.job.updateMany({
    where: {
      roleSlug: {
        notIn: [...CANONICAL_ROLE_SLUGS],
      },
    },
    data: {
      roleSlug: null,
    },
  })

  __slog(`✅ Cleaned ${result.count} jobs (roleSlug set to NULL)`)
}

run()
  .catch((err) => {
    __serr('❌ Cleanup failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
