import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  const total = await prisma.company.count()
  
  const withDesc = await prisma.company.count({
    where: { description: { not: null } }
  })
  
  const withLogo = await prisma.company.count({
    where: { logoUrl: { not: null } }
  })
  
  __slog('Company data stats:')
  __slog('  Total companies:', total)
  __slog('  With description:', withDesc)
  __slog('  With logo:', withLogo)
  
  await prisma.$disconnect()
}
main()
