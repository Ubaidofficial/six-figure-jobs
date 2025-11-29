// scripts/auditCurrencyLocationMismatches.ts
// Audits jobs where the currency doesn't match the country
// Run:
//   npx ts-node scripts/auditCurrencyLocationMismatches.ts
//   npx ts-node scripts/auditCurrencyLocationMismatches.ts --fix

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Very simple "primary currency" map for main markets we care about
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  UK: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  SE: 'SEK',
  CH: 'CHF',
  AU: 'AUD',
  NZ: 'NZD',
  SG: 'SGD',
  IN: 'INR',
}

async function main() {
  const args = process.argv.slice(2)
  const shouldFix = args.includes('--fix')

  console.log('🔍 Auditing currency/location mismatches...\n')

  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      countryCode: { not: null },
      currency: { not: null },
    },
    select: {
      id: true,
      title: true,
      company: true,
      countryCode: true,
      city: true,
      locationRaw: true,
      currency: true,
      minAnnual: true,
      maxAnnual: true,
      salaryRaw: true,
      source: true,
    },
  })

  const mismatches: typeof jobs = []
  const unknownCountry: typeof jobs = []

  for (const job of jobs) {
    const country = (job.countryCode || '').toUpperCase()
    const expected = COUNTRY_CURRENCY[country]

    if (!expected) {
      unknownCountry.push(job)
      continue
    }

    if (job.currency && job.currency !== expected) {
      mismatches.push(job)
    }
  }

  console.log(`Total live jobs with salary + country: ${jobs.length}`)
  console.log(
    `👉 Mismatches (currency != expected for country): ${mismatches.length}`
  )
  console.log(
    `👉 Jobs in countries without mapping: ${unknownCountry.length}\n`
  )

  // Show a sample of mismatches
  console.log('=== SAMPLE MISMATCHES (first 20) ===')
  for (const job of mismatches.slice(0, 20)) {
    const country = (job.countryCode || '').toUpperCase()
    const expected = COUNTRY_CURRENCY[country]
    console.log(`
${job.title} @ ${job.company}
  Location: ${job.city || 'N/A'}, ${country}
  Location raw: ${job.locationRaw || 'N/A'}
  Currency: ${job.currency}  (expected: ${expected})
  Raw: ${job.salaryRaw || 'N/A'}
  Source: ${job.source}
  Job ID: ${job.id}
`)
  }

  if (!shouldFix) {
    console.log(
      '\n💡 Dry run only. To auto-fix the *obvious* ones (set currency = expected for country), run:'
    )
    console.log('   npx ts-node scripts/auditCurrencyLocationMismatches.ts --fix')
    await prisma.$disconnect()
    return
  }

  console.log('\n🔧 Applying auto-fix for obvious mismatches...')

  let fixed = 0
  for (const job of mismatches) {
    const country = (job.countryCode || '').toUpperCase()
    const expected = COUNTRY_CURRENCY[country]
    if (!expected) continue

    // Be conservative: skip US / CA for now, since some jobs have wrong countryCode
    if (country === 'US' || country === 'CA') {
      continue
    }

    // Only touch jobs where salary is clearly real (>= 20k)
    const min = job.minAnnual ? Number(job.minAnnual) : null
    const max = job.maxAnnual ? Number(job.maxAnnual) : null
    const highest = max ?? min ?? 0

    if (highest < 20_000) continue

    await prisma.job.update({
      where: { id: job.id },
      data: { currency: expected },
    })
    fixed++
  }

  console.log(`✅ Updated currency on ${fixed} jobs`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
