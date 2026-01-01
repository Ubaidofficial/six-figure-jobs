import { prisma } from '../lib/prisma'

const MAX_DESC_CHARS = 50_000

async function cleanupBrokenRemote100k() {
  console.log('Starting cleanup of broken Remote100k jobs...')

  const missing = await prisma.job.deleteMany({
    where: {
      source: 'board:remote100k',
      OR: [{ descriptionHtml: null }, { descriptionHtml: { equals: '' } }],
    },
  })

  const oversized = await prisma.$executeRaw`
    DELETE FROM "Job"
    WHERE source = 'board:remote100k'
      AND "descriptionHtml" IS NOT NULL
      AND LENGTH("descriptionHtml") > ${MAX_DESC_CHARS}
  `

  console.log(
    `✅ board:remote100k: Deleted ${missing.count} missing-description jobs and ${Number(oversized)} oversized jobs (> ${MAX_DESC_CHARS} chars)`,
  )
}

async function cleanupOtherBrokenBoardSources() {
  const sources = [
    'board:remote100k',
    'board:career-page',
    'board:remoteotter',
    'board:realworkfromanywhere',
    'board:generic_career_page',
  ]

  console.log('\nCleaning up other broken board sources (missing descriptions only)...')
  for (const source of sources) {
    const deleted = await prisma.job.deleteMany({
      where: {
        source,
        OR: [{ descriptionHtml: null }, { descriptionHtml: { equals: '' } }],
      },
    })
    console.log(`✅ ${source}: Deleted ${deleted.count} jobs with missing descriptions`)
  }
}

async function logRemainingCounts() {
  const remaining = await prisma.job.groupBy({
    by: ['source'],
    _count: { _all: true },
    orderBy: { _count: { _all: 'desc' } },
  })
  console.log('\nRemaining job counts by source:')
  for (const row of remaining) {
    console.log(`- ${row.source}: ${row._count._all}`)
  }
}

async function main() {
  await cleanupBrokenRemote100k()
  await cleanupOtherBrokenBoardSources()
  await logRemainingCounts()
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
