import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const total = await prisma.company.count()
  
  const withDesc = await prisma.company.count({
    where: { description: { not: null } }
  })
  
  const withLogo = await prisma.company.count({
    where: { logoUrl: { not: null } }
  })
  
  console.log('Company data stats:')
  console.log('  Total companies:', total)
  console.log('  With description:', withDesc)
  console.log('  With logo:', withLogo)
  
  await prisma.$disconnect()
}
main()
