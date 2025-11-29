import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  // Check total jobs with descriptions
  const withDesc = await prisma.job.count({
    where: {
      descriptionHtml: { not: null },
      isExpired: false
    }
  })
  
  const total = await prisma.job.count({
    where: { isExpired: false }
  })
  
  console.log(`\n📊 Jobs with descriptions: ${withDesc} / ${total} (${Math.round(withDesc/total*100)}%)`)
  
  // Show a job that HAS description
  const jobWithDesc = await prisma.job.findFirst({
    where: {
      descriptionHtml: { not: null }
    }
  })
  
  if (jobWithDesc) {
    console.log('\n✅ FOUND JOB WITH DESCRIPTION:')
    console.log('Title:', jobWithDesc.title)
    console.log('Company:', jobWithDesc.company)
    console.log('Source:', jobWithDesc.source)
    console.log('Description length:', jobWithDesc.descriptionHtml?.length)
  } else {
    console.log('\n❌ NO JOBS HAVE DESCRIPTIONS!')
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
