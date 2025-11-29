// scripts/disableBadAtsCompanies.ts
// Try scraping each ATS company once; if we hit a hard error (404, Not Found, JSON parse),
// we clear atsProvider/atsUrl so dailyScrape stops wasting time on it.
//
// Run:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/disableBadAtsCompanies.ts

import { PrismaClient } from '@prisma/client'
import { scrapeGreenhouse } from '../lib/scrapers/ats/greenhouse'
import { scrapeLever } from '../lib/scrapers/ats/lever'
import { scrapeAshby } from '../lib/scrapers/ats/ashby'
import { scrapeWorkday } from '../lib/scrapers/ats/workday'

const prisma = new PrismaClient()

type Provider = 'greenhouse' | 'lever' | 'ashby' | 'workday'

const SCRAPERS: Record<Provider, (urlOrSlug: string) => Promise<any[]>> = {
  greenhouse: scrapeGreenhouse,
  lever: scrapeLever,
  ashby: scrapeAshby,
  workday: scrapeWorkday,
}

function getScraper(provider: string) {
  const key = provider.toLowerCase() as Provider
  return SCRAPERS[key] || null
}

function shouldDisableFromError(err: unknown): boolean {
  const msg = (err as any)?.message || String(err || '')

  // Hard-fail patterns: 404s, Not Found, old JSON parse HTML, etc.
  if (/404/i.test(msg)) return true
  if (/not found/i.test(msg)) return true
  if (/Unexpected token</i.test(msg)) return true

  return false
}

async function main() {
  console.log('🔍 Checking ATS companies for permanent failures...\n')

  const companies = await prisma.company.findMany({
    where: {
      atsProvider: { not: null },
      atsUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      atsProvider: true,
      atsUrl: true,
    },
    orderBy: [{ name: 'asc' }],
  })

  console.log(`Found ${companies.length} companies with atsProvider+atsUrl\n`)

  let disabledCount = 0

  for (const company of companies) {
    const provider = company.atsProvider!
    const atsUrl = company.atsUrl!

    const scraper = getScraper(provider)
    if (!scraper) {
      console.log(
        `⚠️  Skipping ${company.name} (${provider}) – no scraper registered`,
      )
      continue
    }

    console.log(
      `\n▶ Testing ${company.name} (${provider}) — ${atsUrl}`,
    )

    try {
      const jobs = await scraper(atsUrl)
      console.log(
        `   ✅ Scraper returned ${jobs.length} jobs — keeping ATS metadata`,
      )
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.error(`   ❌ Error: ${msg}`)

      if (shouldDisableFromError(err)) {
        console.log(
          `   → Disabling ATS for ${company.name} (clearing atsProvider/atsUrl)`,
        )

        await prisma.company.update({
          where: { id: company.id },
          data: {
            atsProvider: null,
            atsUrl: null,
            scrapeStatus: 'disabled',
          },
        })

        disabledCount++
      } else {
        console.log(
          `   → Non-fatal error, leaving ATS metadata in place for now.`,
        )
      }
    }
  }

  console.log('\nDone.')
  console.log(`🚫 Disabled ATS for ${disabledCount} companies`)

  await prisma.$disconnect()
}

if (require.main === module) {
  main().catch((err) => {
    console.error('💥 Script failed:', err)
    process.exit(1)
  })
}
