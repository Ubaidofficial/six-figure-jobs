import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  const jobs = await prisma.job.findMany({
    where: { company: 'Anthropic', isExpired: false },
    take: 5,
    select: { title: true, descriptionHtml: true, locationRaw: true }
  })

  for (const job of jobs) {
    __slog(`\n=== ${job.title} ===`)
    __slog(`Location: ${job.locationRaw}`)
    
    if (job.descriptionHtml) {
      // Find lines with salary/compensation
      const lines = job.descriptionHtml.split(/[<>]/).filter(line => 
        /salary|compensation|\$|€|£|USD|EUR|GBP|AUD|annual|per year/i.test(line)
      )
      if (lines.length > 0) {
        __slog('Salary text found:')
        lines.slice(0, 3).forEach(l => __slog(`  ${l.trim().slice(0, 200)}`))
      } else {
        __slog('No salary text found')
      }
    }
  }

  await prisma.$disconnect()
}
main()
