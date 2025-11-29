import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function decodeHtml(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

async function main() {
  // Find a US job
  const job = await prisma.job.findFirst({
    where: { 
      company: 'Anthropic', 
      isExpired: false,
      countryCode: 'US'
    },
    select: { title: true, descriptionHtml: true, locationRaw: true }
  })

  if (!job?.descriptionHtml) {
    console.log('No US job found')
    return
  }

  console.log(`Job: ${job.title}`)
  console.log(`Location: ${job.locationRaw}`)

  const decoded = decodeHtml(job.descriptionHtml)
  
  // Find text around "Annual Salary"
  const annualIdx = decoded.indexOf('Annual Salary')
  if (annualIdx > -1) {
    console.log('\nSalary section:')
    console.log(decoded.slice(annualIdx, annualIdx + 250))
  }

  await prisma.$disconnect()
}
main()
