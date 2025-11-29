// scripts/fix-instacart.ts
// Run: npx tsx scripts/fix-instacart.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find the corrupted Instacart record
  const corrupted = await prisma.company.findFirst({
    where: { name: { contains: 'InstacartA grocery' } }
  })

  if (!corrupted) {
    console.log('No corrupted Instacart record found')
    return
  }

  console.log('Found corrupted record:', corrupted.id)
  console.log('Current name:', corrupted.name)

  // Fix it
  await prisma.company.update({
    where: { id: corrupted.id },
    data: {
      name: 'Instacart',
      slug: 'instacart',
      description: 'A grocery technology platform connecting consumers with retailers through online shopping, delivery, and pickup services.',
      website: 'https://www.instacart.com',
      countryCode: 'US',
    }
  })

  console.log('✅ Fixed Instacart company record')

  // Verify
  const fixed = await prisma.company.findUnique({
    where: { id: corrupted.id },
    select: { id: true, name: true, slug: true, logoUrl: true }
  })
  console.log('Updated record:', fixed)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())