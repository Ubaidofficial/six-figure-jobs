// scripts/fix-instacart.ts
// Run: npx tsx scripts/fix-instacart.ts

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

async function main() {
  // Find the corrupted Instacart record
  const corrupted = await prisma.company.findFirst({
    where: { name: { contains: 'InstacartA grocery' } }
  })

  if (!corrupted) {
    __slog('No corrupted Instacart record found')
    return
  }

  __slog('Found corrupted record:', corrupted.id)
  __slog('Current name:', corrupted.name)

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

  __slog('✅ Fixed Instacart company record')

  // Verify
  const fixed = await prisma.company.findUnique({
    where: { id: corrupted.id },
    select: { id: true, name: true, slug: true, logoUrl: true }
  })
  __slog('Updated record:', fixed)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())