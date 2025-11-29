// scripts/bootstrapRoleSalaryBands.ts
// Bootstraps JobSlice records for role + salary-band pages.
// Now includes a clean summary at the end.
//
// Run:
//   npx ts-node scripts/bootstrapRoleSalaryBands.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SALARY_BANDS = [
  { minAnnual: 100_000, slug: '100k-plus', label: '$100k+' },
  { minAnnual: 200_000, slug: '200k-plus', label: '$200k+' },
  { minAnnual: 300_000, slug: '300k-plus', label: '$300k+' },
  { minAnnual: 400_000, slug: '400k-plus', label: '$400k+' },
] as const

function roleLabelFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

async function main() {
  console.log('🔧 Bootstrapping JobSlice for role + salary bands...\n')

  // summary counters
  let rolesProcessed = 0
  let createdCount = 0
  let updatedCount = 0
  let skippedEmpty = 0
  const touchedSlugs: string[] = []

  // discover all role slugs that exist on live jobs
  const roles = await prisma.job.findMany({
    where: {
      isExpired: false,
      roleSlug: { not: null },
    },
    select: { roleSlug: true },
    distinct: ['roleSlug'],
  })

  if (roles.length === 0) {
    console.log('No live roles found. Nothing to do.')
    await prisma.$disconnect()
    return
  }

  rolesProcessed = roles.length

  for (const role of roles) {
    const roleSlug = role.roleSlug!
    const roleLabel = roleLabelFromSlug(roleSlug)

    for (const band of SALARY_BANDS) {
      const jobCount = await prisma.job.count({
        where: {
          isExpired: false,
          roleSlug,
          OR: [
            { minAnnual: { gte: BigInt(band.minAnnual) } },
            { maxAnnual: { gte: BigInt(band.minAnnual) } },
          ],
        },
      })

      if (jobCount === 0) {
        skippedEmpty++
        continue
      }

      const slug = `jobs/${roleSlug}/${band.slug}`
      const title = `${roleLabel} jobs paying ${band.label}`
      const h1 = `${roleLabel} jobs paying ${band.label}`
      const description = `Browse ${roleLabel.toLowerCase()} roles paying ${band.label} at top tech companies worldwide.`

      const existing = await prisma.jobSlice.findUnique({
        where: { slug },
        select: { slug: true },
      })

      const result = await prisma.jobSlice.upsert({
        where: { slug },
        create: {
          slug,
          type: 'role-salary',
          filtersJson: JSON.stringify({
            roleSlug,
            minAnnual: band.minAnnual,
          }),
          jobCount,
          title,
          h1,
          description,
        },
        update: {
          type: 'role-salary',
          filtersJson: JSON.stringify({
            roleSlug,
            minAnnual: band.minAnnual,
          }),
          jobCount,
          title,
          h1,
          description,
        },
      })

      touchedSlugs.push(slug)

      if (existing) updatedCount++
      else createdCount++
    }
  }

  // final summary
  console.log('\n==============================')
  console.log('📊 SUMMARY')
  console.log('==============================')
  console.log(`Roles processed:        ${rolesProcessed}`)
  console.log(`Slices created:         ${createdCount}`)
  console.log(`Slices updated:         ${updatedCount}`)
  console.log(`Slices skipped (empty): ${skippedEmpty}`)
  console.log(`Total touched slugs:    ${touchedSlugs.length}`)

  console.log('\nExample slugs:')
  touchedSlugs.slice(0, 10).forEach((slug) => console.log(`  - ${slug}`))
  if (touchedSlugs.length > 10) {
    console.log(`  ... +${touchedSlugs.length - 10} more`)
  }

  console.log('\n✅ Done.')
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Error:', err)
  prisma.$disconnect()
  process.exit(1)
})
