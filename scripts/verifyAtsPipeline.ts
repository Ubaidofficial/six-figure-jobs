// scripts/verifyAtsPipeline.ts
// Phase 3 verification — ATS metadata + scraping sanity check

import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


async function main() {
  __slog('🔍 Verifying ATS metadata + scrapers...\n')

  // 1) Basic counts
  const totalCompanies = await prisma.company.count()
  const withAts = await prisma.company.count({
    where: {
      atsProvider: { not: null },
      atsUrl: { not: null },
    },
  })
  const withoutAts = totalCompanies - withAts

  __slog('📊 Company ATS coverage')
  __slog('------------------------')
  __slog(`Total companies:         ${totalCompanies}`)
  __slog(`With atsProvider+atsUrl: ${withAts}`)
  __slog(`Without ATS metadata:    ${withoutAts}\n`)

  if (withAts === 0) {
    __slog('⚠️  No companies have ATS metadata. Run enrichAtsMetadata.ts first.')
    return
  }

  // 2) Group by provider
  const companiesWithAts = await prisma.company.findMany({
    where: {
      atsProvider: { not: null },
      atsUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      atsProvider: true,
      atsUrl: true,
    },
    orderBy: { name: 'asc' },
  })

  const byProvider: Record<
    string,
    { id: string; name: string; slug: string | null; atsUrl: string }[]
  > = {}

  for (const c of companiesWithAts) {
    const provider = c.atsProvider as string
    if (!byProvider[provider]) byProvider[provider] = []
    byProvider[provider].push({
      id: String(c.id),
      name: c.name,
      slug: c.slug ?? null,
      atsUrl: c.atsUrl as string,
    })
  }

  __slog('📌 Companies by ATS provider')
  __slog('----------------------------')
  for (const [provider, list] of Object.entries(byProvider)) {
    __slog(`- ${provider}: ${list.length} companies`)
  }
  __slog('')

  // 3) Test scraping a small sample per provider (NO DB WRITES)
  __slog('🧪 Testing ATS scrapers (read-only)...')
  __slog('--------------------------------------')

  for (const [provider, list] of Object.entries(byProvider)) {
    const sample = list.slice(0, 3)

    __slog(`\nProvider: ${provider}`)
    if (sample.length === 0) {
      __slog('  (no companies to test)')
      continue
    }

    for (const company of sample) {
      try {
        __slog(
          `  → ${company.name} (${company.slug ?? company.id}) — ${company.atsUrl}`,
        )

        const jobs = await scrapeCompanyAtsJobs(
          provider as any,
          company.atsUrl,
        )

        if (!jobs.success) {
          __slog(`    ❌ ATS failure: ${jobs.error}`)
          continue
        }

        __slog(`    Jobs fetched: ${jobs.jobs.length}`)
        if (jobs.jobs.length > 0) {
          const j = jobs.jobs[0]
          __slog(`    Sample: "${j.title}" — ${j.url}`)
        }
      } catch (err: any) {
        __slog(
          `    ⚠️ Error scraping: ${err?.message ?? String(err)}`,
        )
      }
    }
  }

  __slog('\n✅ Verification run complete.')
}

main()
  .catch((err) => {
    __serr(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
