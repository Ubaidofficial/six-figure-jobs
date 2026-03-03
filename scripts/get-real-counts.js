const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const highSalaryJobs = await prisma.job.count({
    where: {
      isExpired: false,
      OR: [
        { minAnnual: { gte: 100_000 } },
        { maxAnnual: { gte: 100_000 } },
        { isHundredKLocal: true }
      ]
    }
  })
  
  const companies = await prisma.company.count({
    where: {
      jobs: {
        some: {
          isExpired: false,
          OR: [
            { minAnnual: { gte: 100_000 } },
            { isHundredKLocal: true }
          ]
        }
      }
    }
  })

  console.log('High salary jobs:', highSalaryJobs)
  console.log('Companies:', companies)
}

main().finally(() => prisma.$disconnect())
