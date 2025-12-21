const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const byAts = await prisma.company.groupBy({
    by: ['atsProvider'],
    _count: true,
    where: { atsProvider: { not: null } }
  })
  
  console.log('Companies by ATS:')
  console.table(byAts)
  
  const atsJobs = await prisma.$queryRaw`
    SELECT c."atsProvider", COUNT(j.id) as jobs
    FROM "Company" c
    LEFT JOIN "Job" j ON j."companyId" = c.id AND j."isExpired" = false
    WHERE c."atsProvider" IS NOT NULL
    GROUP BY c."atsProvider"
  `
  
  console.log('\nJobs per ATS:')
  console.table(atsJobs)
}

main().finally(() => prisma.$disconnect())
