import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const job = await prisma.job.findFirst({
    where: { company: 'Anthropic', isExpired: false },
    select: { title: true, descriptionHtml: true }
  })

  if (!job?.descriptionHtml) return

  // Find the pay-range section
  const payRangeIdx = job.descriptionHtml.indexOf('pay-range')
  if (payRangeIdx > -1) {
    const snippet = job.descriptionHtml.slice(payRangeIdx, payRangeIdx + 300)
    console.log('Pay range snippet:')
    console.log(snippet)
  }

  // Try different regex
  const match1 = job.descriptionHtml.match(/\$\s*([\d,]+)\s*[-–—]\s*\$?\s*([\d,]+)/s)
  const match2 = job.descriptionHtml.match(/£\s*([\d,]+)\s*[-–—]\s*£?\s*([\d,]+)/s)
  
  console.log('\nUSD match:', match1 ? `${match1[1]} - ${match1[2]}` : 'none')
  console.log('GBP match:', match2 ? `${match2[1]} - ${match2[2]}` : 'none')

  await prisma.$disconnect()
}
main()
