import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get all companies with active jobs
  const companies = await prisma.company.findMany({
    where: { jobs: { some: { isExpired: false } } },
    select: { name: true, slug: true, atsUrl: true },
    orderBy: { name: 'asc' }
  })

  console.log(`Total companies with active jobs: ${companies.length}`)
  console.log('\nCompanies:')
  companies.forEach(c => {
    const ats = c.atsUrl?.includes('greenhouse') ? 'greenhouse' 
      : c.atsUrl?.includes('lever') ? 'lever'
      : c.atsUrl?.includes('ashby') ? 'ashby'
      : 'other'
    console.log(`  ${c.name} (${ats})`)
  })

  await prisma.$disconnect()
}
main()
