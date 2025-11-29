// scripts/fixBadCompanyNames.ts

import { PrismaClient } from '@prisma/client'

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

  console.log(`Found ${badCompanies.length} suspicious companies`)

  for (const c of badCompanies) {
    console.log(`\nCompany id=${c.id} name="${c.name}" atsUrl=${c.atsUrl}`)

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

    console.log(`  -> Setting name="${fixedName}"`)

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

    console.log(`  -> Updated ${updatedJobs.count} jobs.company values`)
  }

  console.log('\nDone.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
