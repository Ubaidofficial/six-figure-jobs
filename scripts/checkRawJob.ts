import { PrismaClient } from '@prisma/client'
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
    console.log(`Job: ${job.title}`)
    console.log(`Source: ${job.source}`)
    console.log(`Has salary keywords in description: ${hasSalary}`)
    
    // Extract any dollar amounts
    const matches = job.descriptionHtml.match(/\$[\d,]+|\d+k/gi)
    if (matches) {
      console.log(`Dollar amounts found: ${matches.slice(0, 5).join(', ')}`)
    }
  }

  await prisma.$disconnect()
}
main()
