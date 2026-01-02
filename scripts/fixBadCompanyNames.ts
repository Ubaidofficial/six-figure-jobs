// scripts/fixBadCompanyNames.ts

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

function prettyNameFromSlug(slug: string | null | undefined): string | null {
  if (!slug) return null
  return slug
    .split(/[-_]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

async function main() {
  // 1. Find companies whose "name" looks like a salary string
  const badCompanies = await prisma.company.findMany({
    where: {
      name: { startsWith: '$' },
    },
  })

  __slog(`Found ${badCompanies.length} suspicious companies`)

  for (const c of badCompanies) {
    __slog(`\nCompany id=${c.id} name="${c.name}" atsUrl=${c.atsUrl}`)

    // If we know specific ones, we can hardcode:
    let fixedName: string | null = null

    // Example: scaleai + reddit
    if (c.atsUrl?.includes('scaleai')) fixedName = 'Scale AI'
    if (c.atsUrl?.includes('reddit')) fixedName = 'Reddit'

    // Fallback: derive from slug if still unknown
    if (!fixedName) {
      fixedName = prettyNameFromSlug(c.slug)
    }

    if (!fixedName) {
      console.warn(`  -> Could not infer a clean name, skipping.`)
      continue
    }

    __slog(`  -> Setting name="${fixedName}"`)

    // 2. Update the Company name
    await prisma.company.update({
      where: { id: c.id },
      data: { name: fixedName },
    })

    // 3. Update all Job.company fields for that company
    const updatedJobs = await prisma.job.updateMany({
      where: { companyId: c.id },
      data: { company: fixedName },
    })

    __slog(`  -> Updated ${updatedJobs.count} jobs.company values`)
  }

  __slog('\nDone.')
}

main()
  .catch((e) => {
    __serr(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
