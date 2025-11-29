import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get a few Anthropic jobs and check their salary fields
  const jobs = await prisma.job.findMany({
    where: { 
      company: 'Anthropic',
      isExpired: false 
    },
    take: 5,
    select: { 
      title: true, 
      salaryRaw: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      countryCode: true,
      locationRaw: true
    }
  })
  
  console.log('Anthropic jobs salary data:')
  jobs.forEach(j => {
    console.log(`\n${j.title}`)
    console.log(`  Location: ${j.locationRaw} (${j.countryCode})`)
    console.log(`  Salary raw: ${j.salaryRaw || 'null'}`)
    console.log(`  Range: ${j.minAnnual}-${j.maxAnnual} ${j.currency}`)
  })

  await prisma.$disconnect()
}
main()
