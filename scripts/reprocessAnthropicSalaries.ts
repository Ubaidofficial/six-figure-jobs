import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

async function main() {
  const jobs = await prisma.job.findMany({
    where: { company: 'Anthropic', isExpired: false },
    select: { id: true, title: true, descriptionHtml: true, locationRaw: true, countryCode: true }
  })

  __slog(`Processing ${jobs.length} Anthropic jobs...`)
  let updated = 0

  for (const job of jobs) {
    if (!job.descriptionHtml) continue

    // Extract salary from pay-range div: <span>$340,000</span>—<span>$560,000</span>
    const payRangeMatch = job.descriptionHtml.match(
      /pay-range[^>]*>.*?([£$€])\s*([\d,]+).*?([£$€])?\s*([\d,]+)/s
    )
    
    if (!payRangeMatch) continue

    const symbol = payRangeMatch[1]
    const minStr = payRangeMatch[2].replace(/,/g, '')
    const maxStr = payRangeMatch[4].replace(/,/g, '')
    
    const min = parseInt(minStr, 10)
    const max = parseInt(maxStr, 10)
    
    // Determine currency from symbol
    let currency = 'USD'
    if (symbol === '£') currency = 'GBP'
    else if (symbol === '€') currency = 'EUR'
    else if (symbol === '$') currency = 'USD'

    // Validate reasonable range
    if (min < 50000 || max > 1000000 || min > max) continue

    const isHighSalary = (currency === 'USD' && min >= 90000) ||
                         (currency === 'GBP' && min >= 75000) ||
                         (currency === 'EUR' && min >= 90000)

    await prisma.job.update({
      where: { id: job.id },
      data: {
        minAnnual: BigInt(min),
        maxAnnual: BigInt(max),
        currency,
        isHighSalary,
        isHundredKLocal: isHighSalary
      }
    })
    
    updated++
    if (updated <= 5) {
      __slog(`  ${job.title}: ${symbol}${min.toLocaleString()}-${symbol}${max.toLocaleString()} ${currency}`)
    }
  }

  __slog(`\nUpdated ${updated} jobs with salary data`)

  // Verify
  const sample = await prisma.job.findMany({
    where: { company: 'Anthropic', countryCode: 'US', minAnnual: { not: null } },
    take: 3,
    select: { title: true, minAnnual: true, maxAnnual: true, currency: true }
  })
  __slog('\nSample US Anthropic jobs:')
  sample.forEach(j => __slog(`  ${j.title}: ${j.currency} ${j.minAnnual}-${j.maxAnnual}`))

  await prisma.$disconnect()
}
main()
