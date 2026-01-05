// scripts/backfill-role-slugs.ts
//
// Backfill Job.roleSlug for active jobs where it is currently NULL.
// Uses the canonical role normalizer (falls back to "other").

import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'
import { normalizeRole } from '../lib/normalizers/role'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

function envInt(name: string, def: number) {
  const v = process.env[name]
  if (!v) return def
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

async function main() {
  const limit = envInt('BACKFILL_ROLE_SLUG_LIMIT', 0) // 0 = no limit
  const batchSize = envInt('BACKFILL_ROLE_SLUG_BATCH', 500)
  const dryRun = process.argv.includes('--dry-run')

  __slog(
    `[backfill-roleSlug] starting limit=${limit || 'all'} batchSize=${batchSize} dryRun=${dryRun}`,
  )

  let cursor: string | undefined
  let processed = 0
  let updated = 0
  let skipped = 0
  let failed = 0

  while (true) {
    const remaining = limit > 0 ? Math.max(0, limit - processed) : batchSize
    if (limit > 0 && remaining === 0) break

    const take = limit > 0 ? Math.min(batchSize, remaining) : batchSize

    const jobs = await prisma.job.findMany({
      where: {
        isExpired: false,
        roleSlug: null,
      },
      select: { id: true, title: true },
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    if (jobs.length === 0) break

    for (const job of jobs) {
      processed++
      cursor = job.id

      try {
        const roleSlug = normalizeRole(job.title).roleSlug || 'other'

        if (!roleSlug) {
          skipped++
          continue
        }

        if (dryRun) {
          __slog(`[backfill-roleSlug] [DRY RUN] ${job.id} -> ${roleSlug}`)
          updated++
          continue
        }

        await prisma.job.update({
          where: { id: job.id },
          data: { roleSlug },
        })
        updated++

        if (updated % 500 === 0) {
          __slog(`[backfill-roleSlug] progress updated=${updated} processed=${processed}`)
        }
      } catch (e: any) {
        failed++
        __serr(`[backfill-roleSlug] failed job=${job.id}`, e?.message || e)
      }
    }
  }

  __slog(
    `[backfill-roleSlug] done processed=${processed} updated=${updated} skipped=${skipped} failed=${failed}`,
  )
}

main()
  .catch((e) => {
    __serr(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

