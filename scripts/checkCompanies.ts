import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Get all companies with active jobs
  const companies = await prisma.company.findMany({
    where: { jobs: { some: { isExpired: false } } },
    select: { name: true, slug: true, atsUrl: true },
    orderBy: { name: 'asc' }
  })

  __slog(`Total companies with active jobs: ${companies.length}`)
  __slog('\nCompanies:')
  companies.forEach(c => {
    const ats = c.atsUrl?.includes('greenhouse') ? 'greenhouse' 
      : c.atsUrl?.includes('lever') ? 'lever'
      : c.atsUrl?.includes('ashby') ? 'ashby'
      : 'other'
    __slog(`  ${c.name} (${ats})`)
  })

  await prisma.$disconnect()
}
main()
