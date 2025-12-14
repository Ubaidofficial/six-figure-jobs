import { prisma } from '../lib/prisma'
import { CANONICAL_ROLE_SLUGS } from '../lib/roles/canonicalSlugs'

async function run() {
  console.log('Starting cleanup of non-canonical role slugs...')

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

  console.log(`✅ Cleaned ${result.count} jobs (roleSlug set to NULL)`)
}

run()
  .catch((err) => {
    console.error('❌ Cleanup failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
