import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

import { detectAtsFromUrl } from '../lib/normalizers/ats'
import { normalizePublicCompanyWebsite } from '../lib/companies/website'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()
const WRITE = process.argv.includes('--write')

async function main() {
  const companies = await prisma.company.findMany({
    where: { website: { not: null } },
    select: {
      id: true,
      name: true,
      website: true,
      atsProvider: true,
      atsUrl: true,
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  let unchanged = 0
  let normalized = 0
  let cleared = 0
  let migratedToAts = 0

  __slog('=== Normalize Company Websites ===')
  __slog(`mode=${WRITE ? 'write' : 'dry-run'}`)
  __slog(`companies=${companies.length}`)
  __slog('')

  for (const company of companies) {
    const website = company.website!
    const publicWebsite = normalizePublicCompanyWebsite(website)
    const detectedAts = detectAtsFromUrl(website)

    if (publicWebsite) {
      if (publicWebsite === website) {
        unchanged++
        continue
      }

      __slog(`NORMALIZE ${company.name}: ${website} -> ${publicWebsite}`)
      normalized++
      if (WRITE) {
        await prisma.company.update({
          where: { id: company.id },
          data: { website: publicWebsite },
        })
      }
      continue
    }

    if (detectedAts) {
      __slog(`MIGRATE ${company.name}: website ${website} -> ATS ${detectedAts.provider} ${detectedAts.atsUrl}`)
      migratedToAts++
      if (WRITE) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            website: null,
            atsProvider: company.atsProvider ?? detectedAts.provider,
            atsUrl: company.atsUrl ?? detectedAts.atsUrl,
          },
        })
      }
      continue
    }

    __slog(`CLEAR ${company.name}: ${website}`)
    cleared++
    if (WRITE) {
      await prisma.company.update({
        where: { id: company.id },
        data: { website: null },
      })
    }
  }

  __slog('')
  __slog('Summary')
  __slog(`  unchanged:      ${unchanged}`)
  __slog(`  normalized:     ${normalized}`)
  __slog(`  migratedToAts:  ${migratedToAts}`)
  __slog(`  cleared:        ${cleared}`)
}

main()
  .catch((error) => {
    __serr('[normalizeCompanyWebsites] error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
