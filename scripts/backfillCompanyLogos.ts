// scripts/backfillCompanyLogos.ts
// Backfill logoUrl using Clearbit when website is present but logoUrl is missing.
// Usage: npx tsx scripts/backfillCompanyLogos.ts

import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


function clearbitUrl(website?: string | null): string | null {
  if (!website) return null
  try {
    const host = new URL(website.includes('://') ? website : `https://${website}`).hostname.replace(
      /^www\./i,
      '',
    )
    if (!host) return null
    return `https://logo.clearbit.com/${host}`
  } catch {
    return null
  }
}

async function main() {
  const companies = await prisma.company.findMany({
    where: {
      logoUrl: null,
      website: { not: null },
    },
    select: { id: true, website: true, name: true },
  })

  __slog(`Found ${companies.length} companies without logos; backfilling…`)

  let updated = 0
  for (const c of companies) {
    const url = clearbitUrl(c.website)
    if (!url) continue

    await prisma.company.update({
      where: { id: c.id },
      data: { logoUrl: url },
    })
    updated++
  }

  __slog(`Updated ${updated} companies with Clearbit logos.`)
}

main()
  .catch((err) => {
    __serr(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
