import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  const jobs = await prisma.job.findMany({
    where: { company: 'Anthropic', isExpired: false },
    take: 3,
    select: { title: true, descriptionHtml: true, locationRaw: true }
  })

  for (const job of jobs) {
    __slog(`\n=== ${job.title} ===`)
    __slog(`Location: ${job.locationRaw}`)
    
    if (job.descriptionHtml) {
      // Look for salary patterns: $XXX,XXX or XXX,XXX USD/EUR etc
      const salaryPattern = /(\$\s*[\d,]+(?:\s*[-–]\s*\$?\s*[\d,]+)?|\d{2,3}[,.]?\d{3}\s*(?:USD|EUR|GBP|AUD|CAD))/gi
      const matches = job.descriptionHtml.match(salaryPattern)
      
      if (matches) {
        __slog(`Salary matches: ${matches.join(' | ')}`)
      }
      
      // Also check for "Annual Salary" or compensation sections
      const compMatch = job.descriptionHtml.match(/(?:annual|base|salary|compensation)[^<]{0,100}[\d,]+/gi)
      if (compMatch) {
        __slog(`Comp text: ${compMatch.slice(0, 2).join(' | ')}`)
      }
    }
  }

  await prisma.$disconnect()
}
main()
