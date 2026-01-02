import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

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
    __slog('Pay range snippet:')
    __slog(snippet)
  }

  // Try different regex
  const match1 = job.descriptionHtml.match(/\$\s*([\d,]+)\s*[-–—]\s*\$?\s*([\d,]+)/s)
  const match2 = job.descriptionHtml.match(/£\s*([\d,]+)\s*[-–—]\s*£?\s*([\d,]+)/s)
  
  __slog('\nUSD match:', match1 ? `${match1[1]} - ${match1[2]}` : 'none')
  __slog('GBP match:', match2 ? `${match2[1]} - ${match2[2]}` : 'none')

  await prisma.$disconnect()
}
main()
