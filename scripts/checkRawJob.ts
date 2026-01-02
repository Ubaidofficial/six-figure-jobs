import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  // Get one Anthropic job that HAD salary data
  const job = await prisma.job.findFirst({
    where: { company: 'Anthropic' },
    select: { 
      id: true,
      title: true, 
      salaryRaw: true,
      descriptionHtml: true,
      source: true
    }
  })
  
  if (job?.descriptionHtml) {
    // Search for salary-related text in description
    const desc = job.descriptionHtml.toLowerCase()
    const hasSalary = desc.includes('salary') || desc.includes('compensation') || desc.includes('$') || desc.includes('usd')
    __slog(`Job: ${job.title}`)
    __slog(`Source: ${job.source}`)
    __slog(`Has salary keywords in description: ${hasSalary}`)
    
    // Extract any dollar amounts
    const matches = job.descriptionHtml.match(/\$[\d,]+|\d+k/gi)
    if (matches) {
      __slog(`Dollar amounts found: ${matches.slice(0, 5).join(', ')}`)
    }
  }

  await prisma.$disconnect()
}
main()
