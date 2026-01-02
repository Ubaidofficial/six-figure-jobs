import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  const company = await prisma.company.findUnique({
    where: { slug: 'anthropic' },
    select: { name: true, description: true, logoUrl: true, website: true, atsUrl: true }
  })
  __slog('Anthropic company data:')
  __slog(JSON.stringify(company, null, 2))
  
  // Check a few more
  const companies = await prisma.company.findMany({
    take: 5,
    select: { name: true, slug: true, description: true }
  })
  __slog('\nSample companies:')
  companies.forEach(c => __slog(`  ${c.slug}: desc=${c.description ? 'YES' : 'NO'}`))

  await prisma.$disconnect()
}
main()
