import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const jobs = await prisma.job.findMany({
    where: { company: 'Anthropic', isExpired: false },
    take: 3,
    select: { title: true, descriptionHtml: true, locationRaw: true }
  })

  for (const job of jobs) {
    console.log(`\n=== ${job.title} ===`)
    console.log(`Location: ${job.locationRaw}`)
    
    if (job.descriptionHtml) {
      // Look for salary patterns: $XXX,XXX or XXX,XXX USD/EUR etc
      const salaryPattern = /(\$\s*[\d,]+(?:\s*[-–]\s*\$?\s*[\d,]+)?|\d{2,3}[,.]?\d{3}\s*(?:USD|EUR|GBP|AUD|CAD))/gi
      const matches = job.descriptionHtml.match(salaryPattern)
      
      if (matches) {
        console.log(`Salary matches: ${matches.join(' | ')}`)
      }
      
      // Also check for "Annual Salary" or compensation sections
      const compMatch = job.descriptionHtml.match(/(?:annual|base|salary|compensation)[^<]{0,100}[\d,]+/gi)
      if (compMatch) {
        console.log(`Comp text: ${compMatch.slice(0, 2).join(' | ')}`)
      }
    }
  }

  await prisma.$disconnect()
}
main()
