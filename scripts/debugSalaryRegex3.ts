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
  const job = await prisma.job.findFirst({
    where: { company: 'Anthropic', isExpired: false },
    select: { title: true, descriptionHtml: true }
  })

  if (!job?.descriptionHtml) return

  const decoded = decodeHtml(job.descriptionHtml)
  
  // Find ALL dollar amounts
  const allDollars = decoded.match(/\$[\d,]+/g)
  __slog('All dollar amounts:', allDollars)

  // Find text around "Annual Salary"
  const annualIdx = decoded.indexOf('Annual Salary')
  if (annualIdx > -1) {
    __slog('\nAround "Annual Salary":')
    __slog(decoded.slice(annualIdx, annualIdx + 200))
  }

  // Find text around dollar signs
  const dollarIdx = decoded.indexOf('$')
  if (dollarIdx > -1) {
    __slog('\nAround first $:')
    __slog(decoded.slice(Math.max(0, dollarIdx - 50), dollarIdx + 100))
  }

  await prisma.$disconnect()
}
main()
