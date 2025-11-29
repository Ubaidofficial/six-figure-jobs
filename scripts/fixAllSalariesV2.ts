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
    .replace(/&mdash;/g, '—')
}

function parseSalaryFromHtml(html: string): { min: number; max: number; currency: string } | null {
  const decoded = decodeHtml(html)
  
  // Pattern: <span>$230,000</span>...<span>$300,000 USD</span>
  // Or: <span>€155.000</span>...<span>€205.000 EUR</span>
  // Or: <span>£240,000</span>...<span>£325,000 GBP</span>
  
  const match = decoded.match(
    /pay-range[^>]*>.*?<span>([£$€])([\d.,]+)<\/span>.*?<span>([£$€])?([\d.,]+)\s*(USD|EUR|GBP|AUD|CAD)?<\/span>/s
  )
  
  if (!match) return null
  
  const symbol = match[1]
  let minStr = match[2]
  let maxStr = match[4]
  const currencyCode = match[5]
  
  // Handle European format (dots as thousands): €155.000 -> 155000
  // Handle US format (commas as thousands): $230,000 -> 230000
  const parseNum = (s: string): number => {
    // If it has a dot but no comma, and dot is followed by 3 digits, it's European
    if (/^\d{1,3}\.\d{3}$/.test(s)) {
      return parseInt(s.replace('.', ''), 10)
    }
    // Otherwise treat as US format
    return parseInt(s.replace(/[,\.]/g, ''), 10)
  }
  
  const min = parseNum(minStr)
  const max = parseNum(maxStr)
  
  // Determine currency
  let currency = 'USD'
  if (currencyCode) {
    currency = currencyCode
  } else if (symbol === '£') {
    currency = 'GBP'
  } else if (symbol === '€') {
    currency = 'EUR'
  }
  
  // Validate
  if (min < 30000 || max > 1000000 || min > max) return null
  
  return { min, max, currency }
}

async function main() {
  // Process ALL Greenhouse jobs (not just Anthropic)
  const jobs = await prisma.job.findMany({
    where: { 
      source: 'ats:greenhouse',
      isExpired: false 
    },
    select: { id: true, title: true, descriptionHtml: true, company: true }
  })

  console.log(`Processing ${jobs.length} Greenhouse jobs...`)
  
  let updated = 0
  let usd = 0, eur = 0, gbp = 0

  for (const job of jobs) {
    if (!job.descriptionHtml) continue

    const salary = parseSalaryFromHtml(job.descriptionHtml)
    if (!salary) continue

    const isHighSalary = 
      (salary.currency === 'USD' && salary.min >= 90000) ||
      (salary.currency === 'GBP' && salary.min >= 75000) ||
      (salary.currency === 'EUR' && salary.min >= 90000) ||
      (salary.currency === 'AUD' && salary.min >= 100000) ||
      (salary.currency === 'CAD' && salary.min >= 100000)

    await prisma.job.update({
      where: { id: job.id },
      data: {
        minAnnual: BigInt(salary.min),
        maxAnnual: BigInt(salary.max),
        currency: salary.currency,
        isHighSalary,
        isHundredKLocal: isHighSalary
      }
    })

    updated++
    if (salary.currency === 'USD') usd++
    else if (salary.currency === 'EUR') eur++
    else if (salary.currency === 'GBP') gbp++

    if (updated <= 5) {
      console.log(`  ${job.company} - ${job.title}: ${salary.currency} ${salary.min.toLocaleString()}-${salary.max.toLocaleString()}`)
    }
  }

  console.log(`\nUpdated ${updated} jobs (USD: ${usd}, EUR: ${eur}, GBP: ${gbp})`)

  // Summary
  const highSalary = await prisma.job.count({ where: { isExpired: false, isHighSalary: true } })
  console.log(`Total high-salary jobs: ${highSalary}`)

  await prisma.$disconnect()
}
main()
