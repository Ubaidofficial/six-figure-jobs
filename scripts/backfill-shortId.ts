// scripts/backfill-shortId.ts
/**
 * Backfill Job.shortId for all existing jobs.
 *
 * Uses the same algorithm as `lib/jobs/jobSlug.ts` `shortStableId()`:
 * FNV-1a 32-bit -> base36 -> first 8 chars.
 *
 * Collision handling:
 * - If the unique constraint on shortId fails, log the conflicting job ids and stop.
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { getShortStableIdForJobId } from '../lib/jobs/jobSlug'

const prisma = new PrismaClient()

async function jobShortIdColumnExists(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND lower(table_name) = 'job'
          AND lower(column_name) = 'shortid'
      ) as "exists"
    `
    return rows?.[0]?.exists === true
  } catch (error) {
    console.error('❌ Failed to check for Job.shortId column:', error)
    return false
  }
}

async function logBatchCollisions(
  updates: Array<{ id: string; shortId: string }>
): Promise<void> {
  const byShortId = new Map<string, string[]>()
  for (const u of updates) {
    const arr = byShortId.get(u.shortId) ?? []
    arr.push(u.id)
    byShortId.set(u.shortId, arr)
  }

  const dupes = [...byShortId.entries()].filter(([, ids]) => ids.length > 1)
  if (dupes.length > 0) {
    console.error('❌ shortId collision detected within batch; stopping.')
    for (const [shortId, ids] of dupes) {
      console.error(`  shortId: ${shortId}`)
      console.error(`  jobIds: ${ids.join(', ')}`)
    }
    return
  }

  const existing = await prisma.job.findMany({
    where: { shortId: { in: [...byShortId.keys()] } },
    select: { id: true, shortId: true },
  })

  if (existing.length === 0) {
    console.error(
      '❌ shortId unique constraint failed, but no conflicting rows were found.'
    )
    return
  }

  console.error('❌ shortId collision detected; stopping.')
  for (const row of existing) {
    const shortId = row.shortId
    if (!shortId) continue
    const attempted = byShortId.get(shortId)?.[0]
    if (attempted && attempted !== row.id) {
      console.error(`  shortId: ${shortId}`)
      console.error(`  jobId (attempted): ${attempted}`)
      console.error(`  jobId (existing): ${row.id}`)
    }
  }
}

async function backfillShortId() {
  console.log('🚀 Starting backfill for Job.shortId...')
  console.log('')

  const hasColumn = await jobShortIdColumnExists()
  if (!hasColumn) {
    console.error('❌ Job.shortId column not found. Run the Prisma migration first.')
    process.exitCode = 1
    return
  }

  const totalMissing = await prisma.job.count({ where: { shortId: null } })
  if (totalMissing === 0) {
    console.log('✅ No jobs missing shortId. Nothing to do.')
    return
  }

  console.log(`📊 Found ${totalMissing.toLocaleString()} jobs missing shortId`)
  console.log('')

  const batchSize = 500
  let processed = 0
  let lastId: string | null = null

  while (true) {
    const jobs: Array<{ id: string }> = await prisma.job.findMany({
      where: {
        shortId: null,
        ...(lastId ? { id: { gt: lastId } } : {}),
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: batchSize,
    })

    if (jobs.length === 0) break

    const updates = jobs.map((job) => ({
      id: job.id,
      shortId: getShortStableIdForJobId(job.id),
    }))

    try {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.job.update({
            where: { id: u.id },
            data: { shortId: u.shortId },
          })
        )
      )
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await logBatchCollisions(updates)
        process.exitCode = 1
        return
      }
      throw error
    }

    processed += jobs.length
    lastId = jobs[jobs.length - 1].id

    const pct = ((processed / totalMissing) * 100).toFixed(1)
    console.log(
      `Progress: ${processed.toLocaleString()}/${totalMissing.toLocaleString()} (${pct}%)`
    )
  }

  console.log('')
  console.log('✅ Backfill complete!')
  console.log(`  • Jobs updated: ${processed.toLocaleString()}`)
}

backfillShortId()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error('❌ Script failed:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
