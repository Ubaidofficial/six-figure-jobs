import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkFields() {
  const job = await prisma.job.findFirst({
    where: { isExpired: false }
  })
  
  if (job) {
    console.log('\n📋 Available description fields:\n')
    console.log('descriptionHtml:', job.descriptionHtml ? '✅ EXISTS' : '❌ NULL')
    console.log('snippet:', job.snippet ? '✅ EXISTS' : '❌ NULL')
    console.log('\nSample descriptionHtml length:', job.descriptionHtml?.length || 0)
    
    if (job.descriptionHtml) {
      console.log('First 200 chars:', job.descriptionHtml.substring(0, 200))
    }
  }
}

checkFields()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
