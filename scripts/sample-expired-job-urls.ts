// scripts/sample-expired-job-urls.ts
// Prints a small sample of expired job canonical URLs (these should 404 today by design).

import { prisma } from '../lib/prisma'
import { getSiteUrl } from '../lib/seo/site'
import { buildJobSlug } from '../lib/jobs/jobSlug'

async function main() {
  const SITE_URL = getSiteUrl()

  const totalExpired = await prisma.job.count({ where: { isExpired: true } })
  // eslint-disable-next-line no-console
  console.log(`expiredJobs=${totalExpired}`)

  const sample = await prisma.job.findMany({
    where: { isExpired: true },
    orderBy: [{ updatedAt: 'desc' }],
    take: 10,
    select: { id: true, title: true, updatedAt: true },
  })

  // eslint-disable-next-line no-console
  console.log('sample:')
  for (const j of sample) {
    const slug = buildJobSlug({ id: j.id, title: j.title })
    // eslint-disable-next-line no-console
    console.log(`${SITE_URL}/job/${slug}\tupdatedAt=${j.updatedAt.toISOString()}\tid=${j.id}`)
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

