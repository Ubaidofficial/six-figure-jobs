// scripts/createTestSlice.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const slug = 'jobs/100k-plus/software-engineer/us'

  const filters = {
    minAnnual: 100_000,
    roleSlugs: ['software-engineer'],
    countryCode: 'US',
  }

  const filtersJson = JSON.stringify(filters)

  const slice = await prisma.jobSlice.upsert({
    where: { slug },
    update: {
      filtersJson,
    },
    create: {
      slug,
      type: 'role-country-salary', // whatever you like; not currently used in code
      filtersJson,
      jobCount: 0, // will be populated later if you want
      title: '$100k+ Software Engineer Jobs in United States',
      description:
        'Browse $100k+ software engineer jobs in the United States from top tech companies.',
      h1: '$100k+ Software Engineer Jobs in United States',
    },
  })

  console.log('Created/updated slice:', slice.slug)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
