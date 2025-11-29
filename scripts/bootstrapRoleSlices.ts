// scripts/bootstrapRoleSlices.ts
// Create / update JobSlice records for all role $100k+ pages
//
// Run:
//   npx ts-node scripts/bootstrapRoleSlices.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Keep this in sync with the role categories you expose in the UI
const ROLE_SLICES = [
  { slug: 'software-engineer', label: 'Software Engineer' },
  { slug: 'senior-software-engineer', label: 'Senior Software Engineer' },
  { slug: 'frontend-engineer', label: 'Frontend Engineer' },
  { slug: 'backend-engineer', label: 'Backend Engineer' },
  { slug: 'fullstack-engineer', label: 'Full-stack Engineer' },

  { slug: 'data-engineer', label: 'Data Engineer' },
  { slug: 'data-scientist', label: 'Data Scientist' },

  { slug: 'machine-learning', label: 'ML / AI Engineer' },
  { slug: 'ml-engineer', label: 'ML Engineer' },
  { slug: 'ai-engineer', label: 'AI Engineer' },

  { slug: 'product-manager', label: 'Product Manager' },
  { slug: 'designer', label: 'Designer' },
  { slug: 'devops', label: 'DevOps / SRE' },
  { slug: 'security-engineer', label: 'Security Engineer' },

  { slug: 'sales', label: 'Sales' },
  { slug: 'account-executive', label: 'Account Executive' },
  { slug: 'marketing', label: 'Marketing' },
] as const

const MIN_SALARY = 100_000

async function main() {
  console.log('🔧 Bootstrapping JobSlice records for role $100k+ pages...\n')

  for (const role of ROLE_SLICES) {
    const fullSlug = `jobs/${role.slug}/100k-plus`

    // Count matching jobs so slice pages show real numbers in SEO copy
    const jobCount = await prisma.job.count({
      where: {
        isExpired: false,
        OR: [
          { maxAnnual: { gte: BigInt(MIN_SALARY) } },
          { minAnnual: { gte: BigInt(MIN_SALARY) } },
          { isHighSalary: true },
        ],
        roleSlug: { contains: role.slug },
      },
    })

    const filters = {
      minAnnual: MIN_SALARY,
      roleSlug: role.slug,
    }

    await prisma.jobSlice.upsert({
      where: { slug: fullSlug }, // assumes `slug` is unique in JobSlice
      create: {
        slug: fullSlug,
        type: 'role-salary',
        filtersJson: JSON.stringify(filters), // 👈 stringify
        jobCount,
        title: `${role.label} jobs paying $100k+`,
        h1: `${role.label} jobs paying $100k+`,
        description: `Browse ${role.label.toLowerCase()} roles paying $100k+ at top tech companies worldwide.`,
      },
      update: {
        type: 'role-salary',
        filtersJson: JSON.stringify(filters), // 👈 stringify
        jobCount,
        title: `${role.label} jobs paying $100k+`,
        h1: `${role.label} jobs paying $100k+`,
        description: `Browse ${role.label.toLowerCase()} roles paying $100k+ at top tech companies worldwide.`,
      },
    })

    console.log(`✓ ${fullSlug} — jobCount=${jobCount}`)
  }

  await prisma.$disconnect()
  console.log('\n✅ Done seeding JobSlice role pages.')
}

main().catch((err) => {
  console.error('Error bootstrapping role slices:', err)
  prisma.$disconnect()
  process.exit(1)
})
