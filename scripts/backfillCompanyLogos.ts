// scripts/backfillCompanyLogos.ts
// Backfill logoUrl using Clearbit when website is present but logoUrl is missing.
// Usage: npx tsx scripts/backfillCompanyLogos.ts

import { prisma } from '../lib/prisma'

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

  console.log(`Found ${companies.length} companies without logos; backfilling…`)

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

  console.log(`Updated ${updated} companies with Clearbit logos.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
