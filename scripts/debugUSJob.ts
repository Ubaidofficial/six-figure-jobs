import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

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
    __slog('No US job found')
    return
  }

  __slog(`Job: ${job.title}`)
  __slog(`Location: ${job.locationRaw}`)

  const decoded = decodeHtml(job.descriptionHtml)
  
  // Find text around "Annual Salary"
  const annualIdx = decoded.indexOf('Annual Salary')
  if (annualIdx > -1) {
    __slog('\nSalary section:')
    __slog(decoded.slice(annualIdx, annualIdx + 250))
  }

  await prisma.$disconnect()
}
main()
