// scripts/verifyAtsPipeline.ts
// Phase 3 verification — ATS metadata + scraping sanity check

import { prisma } from '../lib/prisma'
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'

async function main() {
  console.log('🔍 Verifying ATS metadata + scrapers...\n')

  // 1) Basic counts
  const totalCompanies = await prisma.company.count()
  const withAts = await prisma.company.count({
    where: {
      atsProvider: { not: null },
      atsUrl: { not: null },
    },
  })
  const withoutAts = totalCompanies - withAts

  console.log('📊 Company ATS coverage')
  console.log('------------------------')
  console.log(`Total companies:         ${totalCompanies}`)
  console.log(`With atsProvider+atsUrl: ${withAts}`)
  console.log(`Without ATS metadata:    ${withoutAts}\n`)

  if (withAts === 0) {
    console.log('⚠️  No companies have ATS metadata. Run enrichAtsMetadata.ts first.')
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

  console.log('📌 Companies by ATS provider')
  console.log('----------------------------')
  for (const [provider, list] of Object.entries(byProvider)) {
    console.log(`- ${provider}: ${list.length} companies`)
  }
  console.log('')

  // 3) Test scraping a small sample per provider (NO DB WRITES)
  console.log('🧪 Testing ATS scrapers (read-only)...')
  console.log('--------------------------------------')

  for (const [provider, list] of Object.entries(byProvider)) {
    const sample = list.slice(0, 3)

    console.log(`\nProvider: ${provider}`)
    if (sample.length === 0) {
      console.log('  (no companies to test)')
      continue
    }

    for (const company of sample) {
      try {
        console.log(
          `  → ${company.name} (${company.slug ?? company.id}) — ${company.atsUrl}`,
        )

        const jobs = await scrapeCompanyAtsJobs(
          provider as any,
          company.atsUrl,
        )

        console.log(`    Jobs fetched: ${jobs.length}`)
        if (jobs.length > 0) {
          const j = jobs[0]
          console.log(`    Sample: "${j.title}" — ${j.url}`)
        }
      } catch (err: any) {
        console.log(
          `    ⚠️ Error scraping: ${err?.message ?? String(err)}`,
        )
      }
    }
  }

  console.log('\n✅ Verification run complete.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
