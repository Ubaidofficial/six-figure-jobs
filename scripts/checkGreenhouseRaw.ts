import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  // Find a Greenhouse job
  const job = await prisma.job.findFirst({
    where: {
      source: 'ats:greenhouse'
    }
  })
  
  if (job && job.raw) {
    console.log('\n📋 Greenhouse Job Raw Structure:\n')
    console.log('Title:', job.title)
    console.log('Raw keys:', Object.keys(job.raw).join(', '))
    console.log('\nChecking for description fields:')
    console.log('- raw.content:', !!(job.raw as any).content ? `EXISTS (${(job.raw as any).content?.length} chars)` : 'MISSING')
    console.log('- raw.description:', !!(job.raw as any).description ? 'EXISTS' : 'MISSING')
    console.log('- raw.descriptionHtml:', !!(job.raw as any).descriptionHtml ? 'EXISTS' : 'MISSING')
  } else {
    console.log('No Greenhouse jobs with raw data found')
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
