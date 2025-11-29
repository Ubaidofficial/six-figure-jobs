// scripts/fix-instacart-merge.ts
// Run: npx tsx scripts/fix-instacart-merge.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find all Instacart company records
  const instacarts = await prisma.company.findMany({
    where: { 
      OR: [
        { name: { contains: 'Instacart' } },
        { slug: { contains: 'instacart' } }
      ]
    },
    select: { id: true, name: true, slug: true, logoUrl: true, website: true }
  })

  console.log('Found Instacart records:', instacarts.length)
  instacarts.forEach(c => console.log(`  - ${c.id}: ${c.name?.slice(0, 40)}... | logo: ${c.logoUrl ? 'YES' : 'NO'}`))

  // Find the one with the logo
  const withLogo = instacarts.find(c => c.logoUrl)
  // Find the one the jobs are linked to (the clean one)
  const jobsLinkedTo = await prisma.job.findFirst({
    where: { company: 'Instacart' },
    select: { companyId: true }
  })

  if (!jobsLinkedTo?.companyId) {
    console.log('No jobs linked to Instacart')
    return
  }

  const primaryId = jobsLinkedTo.companyId
  console.log('\nJobs are linked to:', primaryId)

  // Update the primary record with logo from the other
  if (withLogo && withLogo.id !== primaryId) {
    console.log(`\nCopying logo from ${withLogo.id} to ${primaryId}`)
    
    await prisma.company.update({
      where: { id: primaryId },
      data: {
        logoUrl: withLogo.logoUrl,
        website: withLogo.website || 'https://www.instacart.com',
        description: 'A grocery technology platform connecting consumers with retailers through online shopping, delivery, and pickup services.',
      }
    })
    console.log('✅ Updated primary Instacart record with logo')

    // Delete the duplicate
    await prisma.company.delete({
      where: { id: withLogo.id }
    })
    console.log('✅ Deleted duplicate record:', withLogo.id)
  } else if (!withLogo) {
    // No logo anywhere, set a known good one
    console.log('\nNo logo found, setting known Instacart logo...')
    await prisma.company.update({
      where: { id: primaryId },
      data: {
        logoUrl: 'https://logo.clearbit.com/instacart.com',
        website: 'https://www.instacart.com',
        description: 'A grocery technology platform connecting consumers with retailers through online shopping, delivery, and pickup services.',
      }
    })
    console.log('✅ Set Instacart logo from Clearbit')
  }

  // Verify
  const fixed = await prisma.company.findUnique({
    where: { id: primaryId },
    select: { id: true, name: true, slug: true, logoUrl: true, website: true }
  })
  console.log('\nFinal record:', fixed)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())