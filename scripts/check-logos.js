const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const total = await prisma.company.count()
  const withWebsite = await prisma.company.count({ where: { website: { not: null } } })
  const withLogo = await prisma.company.count({ where: { logoUrl: { not: null } } })
  
  console.log('Total companies:', total)
  console.log('With website:', withWebsite)
  console.log('With logoUrl:', withLogo)
  console.log('Missing both:', total - Math.max(withWebsite, withLogo))
}

main().finally(() => prisma.$disconnect())
