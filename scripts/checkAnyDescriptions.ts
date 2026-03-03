import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


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
  
  __slog(`\n📊 Jobs with descriptions: ${withDesc} / ${total} (${Math.round(withDesc/total*100)}%)`)
  
  // Show a job that HAS description
  const jobWithDesc = await prisma.job.findFirst({
    where: {
      descriptionHtml: { not: null }
    }
  })
  
  if (jobWithDesc) {
    __slog('\n✅ FOUND JOB WITH DESCRIPTION:')
    __slog('Title:', jobWithDesc.title)
    __slog('Company:', jobWithDesc.company)
    __slog('Source:', jobWithDesc.source)
    __slog('Description length:', jobWithDesc.descriptionHtml?.length)
  } else {
    __slog('\n❌ NO JOBS HAVE DESCRIPTIONS!')
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
