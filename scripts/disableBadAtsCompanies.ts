// scripts/disableBadAtsCompanies.ts
// Try scraping each ATS company once; if we hit a hard error (404, Not Found, JSON parse),
// we clear atsProvider/atsUrl so dailyScrape stops wasting time on it.
//
// Run:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/disableBadAtsCompanies.ts

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { scrapeGreenhouse } from '../lib/scrapers/ats/greenhouse'
import { scrapeLever } from '../lib/scrapers/ats/lever'
import { scrapeAshby } from '../lib/scrapers/ats/ashby'
import { scrapeWorkday } from '../lib/scrapers/ats/workday'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


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
  __slog('🔍 Checking ATS companies for permanent failures...\n')

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

  __slog(`Found ${companies.length} companies with atsProvider+atsUrl\n`)

  let disabledCount = 0

  for (const company of companies) {
    const provider = company.atsProvider!
    const atsUrl = company.atsUrl!

    const scraper = getScraper(provider)
    if (!scraper) {
      __slog(
        `⚠️  Skipping ${company.name} (${provider}) – no scraper registered`,
      )
      continue
    }

    __slog(
      `\n▶ Testing ${company.name} (${provider}) — ${atsUrl}`,
    )

    try {
      const jobs = await scraper(atsUrl)
      __slog(
        `   ✅ Scraper returned ${jobs.length} jobs — keeping ATS metadata`,
      )
    } catch (err: any) {
      const msg = err?.message || String(err)
      __serr(`   ❌ Error: ${msg}`)

      if (shouldDisableFromError(err)) {
        __slog(
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
        __slog(
          `   → Non-fatal error, leaving ATS metadata in place for now.`,
        )
      }
    }
  }

  __slog('\nDone.')
  __slog(`🚫 Disabled ATS for ${disabledCount} companies`)

  await prisma.$disconnect()
}

if (require.main === module) {
  main().catch((err) => {
    __serr('💥 Script failed:', err)
    process.exit(1)
  })
}
