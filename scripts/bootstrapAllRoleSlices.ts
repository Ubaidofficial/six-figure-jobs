// scripts/bootstrapAllRoleSlices.ts
// Auto-generate JobSlice records for ALL inferred roles with $100k+ jobs.
//
// Run:
//   npx ts-node scripts/bootstrapAllRoleSlices.ts
//
// This will:
//   - Scan Job.roleSlug for distinct roles
//   - Keep only roles with >= MIN_ROLE_JOBS jobs at >= $100k
//   - Upsert JobSlice rows with slug = "jobs/<roleSlug>/100k-plus"
//   - Print a short summary (role count + coverage)

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Minimum annual salary bucket for these slices
const MIN_SALARY = 100_000

// Only create slices for roles that have at least this many jobs
const MIN_ROLE_JOBS = 5

function labelFromSlug(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function main() {
  console.log('🔧 Bootstrapping JobSlice records for ALL inferred roles ($100k+)...\n')

  // 1) Group jobs by roleSlug with salary >= MIN_SALARY
  const grouped = await prisma.job.groupBy({
    by: ['roleSlug'],
    where: {
      isExpired: false,
      roleSlug: { not: null },
      OR: [
        { maxAnnual: { gte: BigInt(MIN_SALARY) } },
        { minAnnual: { gte: BigInt(MIN_SALARY) } },
        { isHighSalary: true },
        { isHundredKLocal: true },
      ],
    },
    _count: { _all: true },
  })

  const roles = grouped
    .filter((g) => g.roleSlug && g._count._all >= MIN_ROLE_JOBS)
    .sort((a, b) => b._count._all - a._count._all)

  if (roles.length === 0) {
    console.log('⚠️ No roles found with enough $100k+ jobs. Nothing to do.')
    await prisma.$disconnect()
    return
  }

  console.log(
    `Found ${grouped.length} distinct roles with $100k+ jobs, ` +
      `${roles.length} have >= ${MIN_ROLE_JOBS} jobs.\n`
  )

  let processed = 0
  let totalJobsCovered = 0

  for (const role of roles) {
    const slug = role.roleSlug as string
    const label = labelFromSlug(slug)
    const fullSlug = `jobs/${slug}/100k-plus`

    const filters = {
      minAnnual: MIN_SALARY,
      roleSlug: slug,
    }

    const jobCount = role._count._all
    totalJobsCovered += jobCount

    await prisma.jobSlice.upsert({
      where: { slug: fullSlug },
      create: {
        slug: fullSlug,
        type: 'role-salary',
        filtersJson: JSON.stringify(filters),
        jobCount,
        title: `${label} jobs paying $100k+`,
        h1: `${label} jobs paying $100k+`,
        description: `Browse ${label.toLowerCase()} roles paying $100k+ at top tech companies worldwide.`,
      },
      update: {
        type: 'role-salary',
        filtersJson: JSON.stringify(filters),
        jobCount,
        title: `${label} jobs paying $100k+`,
        h1: `${label} jobs paying $100k+`,
        description: `Browse ${label.toLowerCase()} roles paying $100k+ at top tech companies worldwide.`,
      },
    })

    processed++
    if (processed <= 20) {
      console.log(`✓ ${fullSlug} — jobCount=${jobCount}`)
    }
  }

  // 2) Short summary so you don't have to paste long logs
  console.log('\n📊 Summary')
  console.log('----------')
  console.log(`Roles processed: ${processed}`)
  console.log(`Min jobs per role: ${MIN_ROLE_JOBS}`)
  console.log(`Total $100k+ jobs covered across slices: ${totalJobsCovered}`)

  // Show top 10 roles by job count
  const top10 = roles.slice(0, 10)
  console.log('\nTop 10 roles by $100k+ job count:')
  top10.forEach((r, idx) => {
    const label = labelFromSlug(r.roleSlug as string)
    console.log(
      `${idx + 1}. ${label} (${r.roleSlug}) — ${r._count._all} jobs`
    )
  })

  await prisma.$disconnect()
  console.log('\n✅ Done seeding JobSlice role pages for all inferred roles.')
}

main().catch((err) => {
  console.error('Error bootstrapping all role slices:', err)
  prisma.$disconnect()
  process.exit(1)
})
