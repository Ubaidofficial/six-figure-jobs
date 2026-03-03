import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

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
  
  __slog('Anthropic jobs salary data:')
  jobs.forEach(j => {
    __slog(`\n${j.title}`)
    __slog(`  Location: ${j.locationRaw} (${j.countryCode})`)
    __slog(`  Salary raw: ${j.salaryRaw || 'null'}`)
    __slog(`  Range: ${j.minAnnual}-${j.maxAnnual} ${j.currency}`)
  })

  await prisma.$disconnect()
}
main()
