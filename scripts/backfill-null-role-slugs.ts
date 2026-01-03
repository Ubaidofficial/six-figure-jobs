// scripts/backfill-null-role-slugs.ts
//
// Backfill Job.roleSlug for active jobs where it is currently NULL.

import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

function envInt(name: string, def: number) {
  const v = process.env[name]
  if (!v) return def
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

function generateRoleSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

async function main() {
  const limit = envInt('BACKFILL_ROLE_SLUG_LIMIT', 10)
  const dryRun = process.argv.includes('--dry-run')

  __slog(`[backfill-roleSlug] starting limit=${limit} dryRun=${dryRun}`)

  const nullSlugJobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      roleSlug: null,
    },
    select: { id: true, title: true },
    orderBy: { createdAt: 'desc' },
    take: limit > 0 ? limit : undefined,
  })

  __slog(`[backfill-roleSlug] found ${nullSlugJobs.length} jobs with NULL roleSlug`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const job of nullSlugJobs) {
    try {
      const roleSlug = generateRoleSlug(job.title || '')
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

      if (updated % 100 === 0) {
        __slog(`[backfill-roleSlug] progress ${updated}/${nullSlugJobs.length}`)
      }
    } catch (e: any) {
      failed++
      __serr(`[backfill-roleSlug] failed job=${job.id}`, e?.message || e)
    }
  }

  __slog(`[backfill-roleSlug] done updated=${updated} skipped=${skipped} failed=${failed}`)
}

main()
  .catch((e) => {
    __serr(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
