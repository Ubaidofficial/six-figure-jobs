// scripts/extractGreenhouseSalaries.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type CliOptions = {
  limit: number | null
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)

  const getArg = (name: string): string | null => {
    const idx = args.indexOf(name)
    if (idx === -1) return null
    return args[idx + 1] ?? null
  }

  const limitArg = getArg('--limit')
  const limit = limitArg ? Number(limitArg) || null : null

  return { limit }
}

function decodeHtml(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
}

function parseSalaryFromHtml(html: string): {
  min: number
  max: number
  currency: string
} | null {
  const decoded = decodeHtml(html)

  // Pattern examples:
  //   <span>$230,000</span>...<span>$300,000 USD</span>
  //   <span>€155.000</span>...<span>€205.000 EUR</span>
  //   <span>£240,000</span>...<span>£325,000 GBP</span>
  const match = decoded.match(
    /pay-range[^>]*>.*?<span>([£$€])([\d.,]+)<\/span>.*?<span>([£$€])?([\d.,]+)\s*(USD|EUR|GBP|AUD|CAD)?<\/span>/s,
  )

  if (!match) return null

  const symbol = match[1]
  const minStr = match[2]
  const maxStr = match[4]
  const currencyCode = match[5]

  const parseNum = (s: string): number => {
    // European style: 155.000
    if (/^\d{1,3}\.\d{3}$/.test(s)) {
      return parseInt(s.replace('.', ''), 10)
    }
    // Otherwise: treat commas & dots as thousand separators
    return parseInt(s.replace(/[,\.]/g, ''), 10)
  }

  const min = parseNum(minStr)
  const max = parseNum(maxStr)

  let currency = 'USD'
  if (currencyCode) {
    currency = currencyCode
  } else if (symbol === '£') {
    currency = 'GBP'
  } else if (symbol === '€') {
    currency = 'EUR'
  }

  // sanity check
  if (min < 30_000 || max > 1_000_000 || min > max) return null

  return { min, max, currency }
}

async function main() {
  const { limit } = parseCliArgs()

  console.log('🔎 Extracting salaries from Greenhouse HTML…')
  console.log(`   Limit: ${limit ?? 'none'}`)
  console.log('')

  // 👉 Only jobs that actually NEED salary fixes
  const jobs = await prisma.job.findMany({
    where: {
      source: 'ats:greenhouse',
      isExpired: false,
      OR: [
        { minAnnual: null },
        { maxAnnual: null },
        { currency: null },
      ],
    },
    select: {
      id: true,
      title: true,
      descriptionHtml: true,
      company: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
    },
    take: limit ?? undefined,
  })

  console.log(`Processing ${jobs.length} Greenhouse jobs that need salary normalization...`)

  let processed = 0
  let updated = 0
  let usd = 0
  let eur = 0
  let gbp = 0

  for (const job of jobs) {
    processed++

    if (!job.descriptionHtml) continue

    const salary = parseSalaryFromHtml(job.descriptionHtml)
    if (!salary) continue

    const isHighSalary =
      (salary.currency === 'USD' && salary.min >= 90_000) ||
      (salary.currency === 'GBP' && salary.min >= 75_000) ||
      (salary.currency === 'EUR' && salary.min >= 90_000) ||
      (salary.currency === 'AUD' && salary.min >= 100_000) ||
      (salary.currency === 'CAD' && salary.min >= 100_000)

    await prisma.job.update({
      where: { id: job.id },
      data: {
        minAnnual: BigInt(salary.min),
        maxAnnual: BigInt(salary.max),
        currency: salary.currency,
        isHighSalary,
        isHundredKLocal: isHighSalary,
      },
    })

    updated++
    if (salary.currency === 'USD') usd++
    else if (salary.currency === 'EUR') eur++
    else if (salary.currency === 'GBP') gbp++

    // Log first 5, then progress every 200 jobs
    if (updated <= 5) {
      console.log(
        `  ${job.company} - ${job.title}: ${salary.currency} ${salary.min.toLocaleString()}–${salary.max.toLocaleString()}`,
      )
    } else if (processed % 200 === 0) {
      console.log(
        `   …processed ${processed} / ${jobs.length} jobs, updated ${updated}`,
      )
    }
  }

  console.log(
    `\n✅ Updated ${updated} jobs (USD: ${usd}, EUR: ${eur}, GBP: ${gbp})`,
  )

  const highSalary = await prisma.job.count({
    where: { isExpired: false, isHighSalary: true },
  })
  console.log(`📊 Total high-salary jobs: ${highSalary}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  prisma
    .$disconnect()
    .finally(() => process.exit(1))
})
