import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const company = await prisma.company.findUnique({
    where: { slug: 'anthropic' },
    select: { name: true, description: true, logoUrl: true, website: true, atsUrl: true }
  })
  console.log('Anthropic company data:')
  console.log(JSON.stringify(company, null, 2))
  
  // Check a few more
  const companies = await prisma.company.findMany({
    take: 5,
    select: { name: true, slug: true, description: true }
  })
  console.log('\nSample companies:')
  companies.forEach(c => console.log(`  ${c.slug}: desc=${c.description ? 'YES' : 'NO'}`))

  await prisma.$disconnect()
}
main()
