const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Jobs by source
  const bySource = await prisma.$queryRaw`
    SELECT source, COUNT(*) as jobs, COUNT(DISTINCT "companyId") as companies
    FROM "Job" 
    WHERE "isExpired" = false
    GROUP BY source 
    ORDER BY jobs DESC
  `
  
  console.log('📊 Active Jobs by Source:')
  console.table(bySource)
  
  // ATS coverage
  const atsJobs = await prisma.job.count({
    where: { 
      isExpired: false,
      source: { in: ['greenhouse', 'lever', 'ashby'] }
    }
  })
  
  const boardJobs = await prisma.job.count({
    where: { 
      isExpired: false,
      source: { in: ['remoteok', 'weworkremotely', 'remote100k'] }
    }
  })
  
  console.log('\n📈 Coverage Summary:')
  console.log(`ATS jobs: ${atsJobs}`)
  console.log(`Board jobs: ${boardJobs}`)
  console.log(`Generic: ${await prisma.job.count({ where: { isExpired: false, source: 'generic_career_page' }})}`)
}

main().finally(() => prisma.$disconnect())
