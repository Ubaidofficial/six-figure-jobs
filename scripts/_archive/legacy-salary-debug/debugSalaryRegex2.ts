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
  
  // Find the pay-range section
  const payRangeIdx = decoded.indexOf('pay-range')
  if (payRangeIdx > -1) {
    const snippet = decoded.slice(payRangeIdx, payRangeIdx + 500)
    __slog('Pay range snippet (decoded):')
    __slog(snippet)
  }

  // Try regex on decoded
  const match1 = decoded.match(/\$\s*([\d,]+)\s*[-–—]\s*\$?\s*([\d,]+)/)
  __slog('\nUSD match:', match1 ? `$${match1[1]} - $${match1[2]}` : 'none')

  await prisma.$disconnect()
}
main()
