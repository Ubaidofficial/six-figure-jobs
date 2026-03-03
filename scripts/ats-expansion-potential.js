const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const total = await prisma.company.count()
  const withAts = await prisma.company.count({
    where: {
      OR: [
        { atsProvider: { not: null } },
        { sources: { some: { sourceType: { in: ['greenhouse', 'lever', 'ashby'] }}}}
      ]
    }
  })
  
  console.log(`Total companies: ${total}`)
  console.log(`With ATS: ${withAts}`)
  console.log(`❌ Missing ATS discovery: ${total - withAts}`)
  console.log(`\n💡 Potential: Run ATS discovery on ${total - withAts} companies`)
}

main().finally(() => prisma.$disconnect())
