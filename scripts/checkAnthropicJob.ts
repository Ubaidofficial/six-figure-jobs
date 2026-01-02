import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

async function check() {
  const job = await prisma.job.findFirst({
    where: {
      company: { contains: 'Anthropic' }
    }
  })
  
  if (job) {
    __slog('\n📋 Anthropic Job Check:\n')
    __slog('Title:', job.title)
    __slog('Source:', job.source)
    __slog('Has descriptionHtml?', !!job.descriptionHtml)
    __slog('descriptionHtml length:', job.descriptionHtml?.length || 0)
    
    if (job.descriptionHtml) {
      __slog('First 200 chars:', job.descriptionHtml.substring(0, 200))
    }
  } else {
    __slog('No Anthropic jobs found!')
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
