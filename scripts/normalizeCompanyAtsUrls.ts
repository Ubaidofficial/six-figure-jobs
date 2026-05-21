import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

import { detectAtsFromUrl } from '../lib/normalizers/ats'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()
const WRITE = process.argv.includes('--write')

async function main() {
  const companies = await prisma.company.findMany({
    where: {
      atsProvider: { not: null },
      atsUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      atsProvider: true,
      atsUrl: true,
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  let unchanged = 0
  let normalized = 0
  let cleared = 0

  __slog('=== Normalize Company ATS URLs ===')
  __slog(`mode=${WRITE ? 'write' : 'dry-run'}`)
  __slog(`companies=${companies.length}`)
  __slog('')

  for (const company of companies) {
    const detected = detectAtsFromUrl(company.atsUrl)

    if (!detected) {
      __slog(`CLEAR ${company.name}: [${company.atsProvider}] ${company.atsUrl}`)
      cleared++
      if (WRITE) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            atsProvider: null,
            atsUrl: null,
            atsSlug: null,
            scrapeStatus: 'error',
            scrapeError: 'ATS URL failed normalization',
          },
        })
      }
      continue
    }

    if (detected.provider === company.atsProvider && detected.atsUrl === company.atsUrl) {
      unchanged++
      continue
    }

    __slog(
      `NORMALIZE ${company.name}: [${company.atsProvider}] ${company.atsUrl} -> [${detected.provider}] ${detected.atsUrl}`,
    )
    normalized++

    if (WRITE) {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          atsProvider: detected.provider,
          atsUrl: detected.atsUrl,
          atsSlug: null,
          scrapeStatus: null,
          scrapeError: null,
        },
      })
    }
  }

  __slog('')
  __slog('Summary')
  __slog(`  unchanged:  ${unchanged}`)
  __slog(`  normalized: ${normalized}`)
  __slog(`  cleared:    ${cleared}`)
}

main()
  .catch((error) => {
    __serr('[normalizeCompanyAtsUrls] error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
