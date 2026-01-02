import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'
import type { AtsProvider } from '../lib/scrapers/ats/types'
import { upsertJobsForCompanyFromAts } from '../lib/jobs/ingestFromAts'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


function toAtsProvider(atsType: string): AtsProvider | null {
  const t = String(atsType || '').toLowerCase().trim()
  if (t === 'greenhouse' || t === 'lever' || t === 'ashby' || t === 'workday') return t
  return null
}

async function ensureCompanyRow(input: {
  companyName: string
  companySlug: string
  atsProvider: AtsProvider
  atsUrl: string
}) {
  return prisma.company.upsert({
    where: { slug: input.companySlug },
    update: {
      name: input.companyName,
      atsProvider: input.atsProvider,
      atsUrl: input.atsUrl,
    },
    create: {
      name: input.companyName,
      slug: input.companySlug,
      atsProvider: input.atsProvider,
      atsUrl: input.atsUrl,
    },
  })
}

async function scrapeDirectATS() {
  __slog('='.repeat(60))
  __slog('DIRECT ATS SCRAPER')
  __slog('='.repeat(60))

  const companies = await prisma.companyATS.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })

  __slog(`\nFound ${companies.length} companies to scrape\n`)

  const stats = { total: companies.length, scraped: 0, jobs: 0, errors: 0, skipped: 0 }

  for (const company of companies) {
    __slog(`\n▶ ${company.companyName} (${company.atsType})`)

    const provider = toAtsProvider(company.atsType)

    if (!provider) {
      __slog(`  ⏭️  Unsupported ATS: ${company.atsType}`)
      stats.skipped++
      continue
    }

    if (provider === 'workday') {
      __slog(`  ⏭️  Workday (not implemented yet)`)
      stats.skipped++
      continue
    }

    try {
      const companyRow = await ensureCompanyRow({
        companyName: company.companyName,
        companySlug: company.companySlug,
        atsProvider: provider,
        atsUrl: company.atsUrl,
      })

      const jobs = await scrapeCompanyAtsJobs(provider, company.atsUrl)
      const result = await upsertJobsForCompanyFromAts(companyRow, jobs)

      stats.scraped++
      stats.jobs += result.created || 0

      __slog(`  ✓ ${result.created} created, ${result.skipped} skipped`)

      await prisma.company.update({
        where: { id: companyRow.id },
        data: {
          lastScrapedAt: new Date(),
          jobCount: jobs.length,
          scrapeStatus: 'success',
          scrapeError: null,
        },
      })

      await prisma.companyATS.update({
        where: { id: company.id },
        data: { lastScraped: new Date(), jobCount: result.created || 0 },
      })
    } catch (err: any) {
      stats.errors++
      __serr(`  ❌ ${err?.message || err}`)
    }
  }

  __slog('\n' + '='.repeat(60))
  __slog('SUMMARY')
  __slog('='.repeat(60))
  __slog(`Companies: ${stats.scraped}/${stats.total} (${stats.skipped} skipped)`)
  __slog(`Jobs created: ${stats.jobs}`)
  __slog(`Errors: ${stats.errors}`)
  __slog('='.repeat(60))
}

scrapeDirectATS()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

