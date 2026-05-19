import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

import { classifyGenericCareerSource } from '../lib/scrapers/utils/companyCareersDiscovery'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()

function shouldWrite(): boolean {
  return process.argv.includes('--write')
}

async function main() {
  const write = shouldWrite()

  const sources = await prisma.companySource.findMany({
    where: {
      sourceType: 'generic_careers_page',
      isActive: true,
    },
    select: {
      id: true,
      url: true,
      company: {
        select: {
          name: true,
          website: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  const invalid = sources
    .map((source) => ({
      source,
      verdict: classifyGenericCareerSource(source.url, source.company.website),
    }))
    .filter((entry) => !entry.verdict.valid)

  const byReason = new Map<string, number>()
  for (const entry of invalid) {
    byReason.set(entry.verdict.reason, (byReason.get(entry.verdict.reason) || 0) + 1)
  }

  __slog('=== Generic Career Source Cleanup ===')
  __slog(`mode=${write ? 'write' : 'dry-run'}`)
  __slog(`active sources=${sources.length}`)
  __slog(`invalid sources=${invalid.length}`)
  if (byReason.size > 0) {
    __slog('reasons:')
    for (const [reason, count] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
      __slog(`  ${reason}: ${count}`)
    }
  }

  const preview = invalid.slice(0, 20)
  if (preview.length > 0) {
    __slog('samples:')
    for (const entry of preview) {
      __slog(
        `  ${entry.source.company.name}: ${entry.source.url} [${entry.verdict.reason}]`,
      )
    }
  }

  if (!write || invalid.length === 0) return

  let updated = 0
  for (const entry of invalid) {
    await prisma.companySource.update({
      where: { id: entry.source.id },
      data: {
        isActive: false,
        scrapeStatus: 'error',
        scrapeError: `Auto-disabled: invalid generic careers source (${entry.verdict.reason})`,
      },
    })
    updated++
  }

  __slog(`deactivated=${updated}`)
}

main()
  .catch((error) => {
    __serr('[cleanupGenericCareerSources] error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
