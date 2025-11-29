import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get companies that failed with 404
  const failed = await prisma.company.findMany({
    where: { scrapeError: { contains: '404' } },
    select: { name: true }
  })
  
  console.log('Found', failed.length, 'companies with 404 errors')
  console.log('Sample:', failed.slice(0, 10).map(c => c.name).join(', '))
  
  // Clear their atsUrl since it's wrong
  const result = await prisma.company.updateMany({
    where: { scrapeError: { contains: '404' } },
    data: { atsUrl: null, scrapeStatus: null, scrapeError: null }
  })
  
  console.log('Cleared atsUrl for', result.count, 'companies')
  
  // Show remaining companies with valid ATS URLs
  const remaining = await prisma.company.count({ where: { atsUrl: { not: null } } })
  console.log('Remaining companies with ATS URLs:', remaining)
  
  // Show successful companies
  const successful = await prisma.company.findMany({
    where: { scrapeStatus: 'success' },
    select: { name: true, jobCount: true },
    orderBy: { jobCount: 'desc' },
    take: 20
  })
  console.log('\nTop successful companies:')
  for (const c of successful) {
    console.log(' ', c.name, '-', c.jobCount, 'jobs')
  }
  
  await prisma.$disconnect()
}
main()
