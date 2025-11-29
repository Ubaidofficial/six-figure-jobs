import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const job = await prisma.job.findFirst({
    where: {
      company: { contains: 'Anthropic' }
    }
  })
  
  if (job) {
    console.log('\n📋 Anthropic Job Check:\n')
    console.log('Title:', job.title)
    console.log('Source:', job.source)
    console.log('Has descriptionHtml?', !!job.descriptionHtml)
    console.log('descriptionHtml length:', job.descriptionHtml?.length || 0)
    
    if (job.descriptionHtml) {
      console.log('First 200 chars:', job.descriptionHtml.substring(0, 200))
    }
  } else {
    console.log('No Anthropic jobs found!')
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
