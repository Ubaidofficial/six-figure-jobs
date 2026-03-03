import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Get companies that failed with 404
  const failed = await prisma.company.findMany({
    where: { scrapeError: { contains: '404' } },
    select: { name: true }
  })
  
  __slog('Found', failed.length, 'companies with 404 errors')
  __slog('Sample:', failed.slice(0, 10).map(c => c.name).join(', '))
  
  // Clear their atsUrl since it's wrong
  const result = await prisma.company.updateMany({
    where: { scrapeError: { contains: '404' } },
    data: { atsUrl: null, scrapeStatus: null, scrapeError: null }
  })
  
  __slog('Cleared atsUrl for', result.count, 'companies')
  
  // Show remaining companies with valid ATS URLs
  const remaining = await prisma.company.count({ where: { atsUrl: { not: null } } })
  __slog('Remaining companies with ATS URLs:', remaining)
  
  // Show successful companies
  const successful = await prisma.company.findMany({
    where: { scrapeStatus: 'success' },
    select: { name: true, jobCount: true },
    orderBy: { jobCount: 'desc' },
    take: 20
  })
  __slog('\nTop successful companies:')
  for (const c of successful) {
    __slog(' ', c.name, '-', c.jobCount, 'jobs')
  }
  
  await prisma.$disconnect()
}
main()
