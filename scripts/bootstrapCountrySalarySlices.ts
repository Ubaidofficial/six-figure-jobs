// scripts/bootstrapCountrySalarySlices.ts
// Bootstraps JobSlice records for global + country salary-band pages.
//
// Run:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/bootstrapCountrySalarySlices.ts

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

const SALARY_BANDS = [
  { minAnnual: 100_000, slug: '100k-plus', label: '$100k+' },
  { minAnnual: 200_000, slug: '200k-plus', label: '$200k+' },
  { minAnnual: 300_000, slug: '300k-plus', label: '$300k+' },
  { minAnnual: 400_000, slug: '400k-plus', label: '$400k+' },
] as const

function countryLabelFromCode(code: string): string {
  const upper = code.toUpperCase()
  switch (upper) {
    case 'US':
      return 'United States'
    case 'GB':
      return 'United Kingdom'
    case 'CA':
      return 'Canada'
    case 'AU':
      return 'Australia'
    case 'DE':
      return 'Germany'
    case 'FR':
      return 'France'
    case 'NL':
      return 'Netherlands'
    case 'SG':
      return 'Singapore'
    default:
      return upper
  }
}

async function main() {
  __slog('🔧 Bootstrapping JobSlice records for global + country salary pages...\n')

  let createdCount = 0
  let updatedCount = 0
  const touchedSlugs: string[] = []

  // 1) GLOBAL salary bands: jobs/100k-plus, jobs/200k-plus, etc.
  for (const band of SALARY_BANDS) {
    const jobCount = await prisma.job.count({
      where: {
        isExpired: false,
        OR: [
          { minAnnual: { gte: BigInt(band.minAnnual) } },
          { maxAnnual: { gte: BigInt(band.minAnnual) } },
        ],
      },
    })

    if (jobCount === 0) continue

    const slug = `jobs/${band.slug}`

    const filters = {
      minAnnual: band.minAnnual,
    }

    const existing = await prisma.jobSlice.findUnique({
      where: { slug },
      select: { slug: true },
    })

    const result = await prisma.jobSlice.upsert({
      where: { slug },
      create: {
        slug,
        type: 'salary-global',
        filtersJson: JSON.stringify(filters),
        jobCount,
        title: `Tech jobs paying ${band.label}`,
        h1: `Tech jobs paying ${band.label}`,
        description: `Browse tech jobs paying ${band.label} at top companies worldwide.`,
      },
      update: {
        type: 'salary-global',
        filtersJson: JSON.stringify(filters),
        jobCount,
        title: `Tech jobs paying ${band.label}`,
        h1: `Tech jobs paying ${band.label}`,
        description: `Browse tech jobs paying ${band.label} at top companies worldwide.`,
      },
    })

    touchedSlugs.push(slug)
    if (existing) updatedCount++
    else createdCount++

    __slog(`✓ ${slug} — jobCount=${jobCount}`)
  }

  // 2) COUNTRY + salary bands: jobs/gb/100k-plus, jobs/us/100k-plus, etc.
  const countries = await prisma.job.findMany({
    where: {
      isExpired: false,
      countryCode: { not: null },
    },
    select: { countryCode: true },
    distinct: ['countryCode'],
  })

  for (const c of countries) {
    const countryCode = c.countryCode!
    const countrySlug = countryCode.toLowerCase()
    const countryLabel = countryLabelFromCode(countryCode)

    for (const band of SALARY_BANDS) {
      const jobCount = await prisma.job.count({
        where: {
          isExpired: false,
          countryCode,
          OR: [
            { minAnnual: { gte: BigInt(band.minAnnual) } },
            { maxAnnual: { gte: BigInt(band.minAnnual) } },
          ],
        },
      })

      if (jobCount === 0) continue

      const slug = `jobs/${countrySlug}/${band.slug}`

      const filters = {
        minAnnual: band.minAnnual,
        countryCode,
      }

      const existing = await prisma.jobSlice.findUnique({
        where: { slug },
        select: { slug: true },
      })

      const result = await prisma.jobSlice.upsert({
        where: { slug },
        create: {
          slug,
          type: 'salary-country',
          filtersJson: JSON.stringify(filters),
          jobCount,
          title: `${countryLabel} tech jobs paying ${band.label}`,
          h1: `${countryLabel} tech jobs paying ${band.label}`,
          description: `Browse tech jobs paying ${band.label} in ${countryLabel}.`,
        },
        update: {
          type: 'salary-country',
          filtersJson: JSON.stringify(filters),
          jobCount,
          title: `${countryLabel} tech jobs paying ${band.label}`,
          h1: `${countryLabel} tech jobs paying ${band.label}`,
          description: `Browse tech jobs paying ${band.label} in ${countryLabel}.`,
        },
      })

      touchedSlugs.push(slug)
      if (existing) updatedCount++
      else createdCount++

      __slog(`✓ ${slug} — jobCount=${jobCount}`)
    }
  }

  __slog('\n==============================')
  __slog('📊 SUMMARY')
  __slog('==============================')
  __slog(`Slices created:         ${createdCount}`)
  __slog(`Slices updated:         ${updatedCount}`)
  __slog(`Total touched slugs:    ${touchedSlugs.length}`)

  __slog('\nExample slugs:')
  touchedSlugs.slice(0, 10).forEach((slug) => __slog(`  - ${slug}`))
  if (touchedSlugs.length > 10) {
    __slog(`  ... +${touchedSlugs.length - 10} more`)
  }

  __slog('\n✅ Done.')
  await prisma.$disconnect()
}

main().catch((err) => {
  __serr('Error bootstrapping country salary slices:', err)
  prisma.$disconnect()
  process.exit(1)
})
