import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const jobs = await prisma.job.findMany({
    where: { company: 'Anthropic', isExpired: false },
    take: 5,
    select: { title: true, descriptionHtml: true, locationRaw: true }
  })

  for (const job of jobs) {
    console.log(`\n=== ${job.title} ===`)
    console.log(`Location: ${job.locationRaw}`)
    
    if (job.descriptionHtml) {
      // Find lines with salary/compensation
      const lines = job.descriptionHtml.split(/[<>]/).filter(line => 
        /salary|compensation|\$|€|£|USD|EUR|GBP|AUD|annual|per year/i.test(line)
      )
      if (lines.length > 0) {
        console.log('Salary text found:')
        lines.slice(0, 3).forEach(l => console.log(`  ${l.trim().slice(0, 200)}`))
      } else {
        console.log('No salary text found')
      }
    }
  }

  await prisma.$disconnect()
}
main()
