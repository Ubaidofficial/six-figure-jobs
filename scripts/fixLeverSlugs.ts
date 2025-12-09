// scripts/fixLeverSlugs.ts
//
// Attempts to fix bad Lever slugs by:
//  1) Normalizing atsUrl to https://jobs.lever.co/<slug>
//  2) Following redirects on atsUrl
//  3) Extracting the final slug from the final URL
//  4) Updating Company.atsSlug + Company.atsUrl if changed
//  5) Optionally calling scrapeLever for diagnostics (job count)
//
// Run with:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fixLeverSlugs.ts

import { PrismaClient } from '@prisma/client'
import { scrapeLever } from '../lib/scrapers/ats/lever'
import type { AtsJob } from '../lib/scrapers/ats/types'

const prisma = new PrismaClient()

// Just for logging; no DB side-effects based on this.
const CHECK_LEVER_JOBS = true

// Node 18+ has global fetch; declare to keep TS happy.
declare const fetch: any

function normalizeLeverUrl(input: string): string {
  let url = input.trim()

  if (!url.startsWith('http')) {
    url = `https://jobs.lever.co/${url}`
  }

  try {
    const u = new URL(url)
    // Force host to jobs.lever.co if it’s some variant
    if (!u.hostname.includes('lever.co')) {
      // Don’t mangle totally foreign hosts
      return url
    }
    if (u.hostname !== 'jobs.lever.co') {
      u.hostname = 'jobs.lever.co'
    }
    return u.toString().replace(/\/$/, '')
  } catch {
    return url.replace(/\/$/, '')
  }
}

function extractLeverSlug(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('lever.co')) return null

    const parts = u.pathname.split('/').filter(Boolean)
    // jobs.lever.co/<slug> or jobs.lever.co/<slug>/something
    if (parts.length === 0) return null
    return parts[0]
  } catch {
    return null
  }
}

async function resolveFinalUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'SixFigureJobs/1.0 (+lever-fix)',
      },
      cache: 'no-store',
    })

    const finalUrl = res.url || url
    return finalUrl.replace(/\/$/, '')
  } catch (err: any) {
    console.error(`  ⚠️ Error resolving ${url}: ${err?.message || err}`)
    return null
  }
}

async function checkLeverJobs(atsSlugOrUrl: string): Promise<number | null> {
  try {
    const jobs: AtsJob[] = await scrapeLever(atsSlugOrUrl)
    return jobs.length
  } catch (err: any) {
    console.error(
      `  ⚠️ scrapeLever error for ${atsSlugOrUrl}: ${err?.message || err}`,
    )
    return null
  }
}

async function main() {
  console.log('🔧 Fixing Lever slugs based on redirects...\n')

  const companies = await prisma.company.findMany({
    where: {
      atsProvider: 'lever',
      atsUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      atsSlug: true,
      atsUrl: true,
    },
    orderBy: { name: 'asc' },
  })

  console.log(`Found ${companies.length} Lever companies to inspect.\n`)

  let fixedCount = 0
  let unchangedCount = 0
  let errorCount = 0

  for (const c of companies) {
    const currentUrl = normalizeLeverUrl(c.atsUrl as string)
    console.log(`▶ ${c.name}`)
    console.log(`   Current atsUrl:  ${currentUrl}`)
    console.log(`   Current atsSlug: ${c.atsSlug || '(none)'}`)

    const initialSlug =
      c.atsSlug || extractLeverSlug(currentUrl) || '(unknown)'

    const finalUrl = await resolveFinalUrl(currentUrl)
    if (!finalUrl) {
      console.log('   ❌ Could not resolve final URL, skipping.\n')
      errorCount++
      continue
    }

    const finalSlug = extractLeverSlug(finalUrl)
    if (!finalSlug) {
      console.log(`   ❌ Could not extract slug from final URL: ${finalUrl}\n`)
      errorCount++
      continue
    }

    console.log(`   → Final URL:   ${finalUrl}`)
    console.log(`   → Initial slug: ${initialSlug}`)
    console.log(`   → Final slug:   ${finalSlug}`)

    let jobCount: number | null = null
    if (CHECK_LEVER_JOBS) {
      jobCount = await checkLeverJobs(finalSlug)
      if (jobCount != null) {
        console.log(`   → scrapeLever("${finalSlug}") jobs: ${jobCount}`)
      }
    }

    const normalizedFinalUrl = normalizeLeverUrl(finalSlug)

    const slugChanged = c.atsSlug !== finalSlug
    const urlChanged = currentUrl !== normalizedFinalUrl

    if (!slugChanged && !urlChanged) {
      console.log('   ✅ Slug/URL already up to date.\n')
      unchangedCount++
      continue
    }

    try {
      await prisma.company.update({
        where: { id: c.id },
        data: {
          atsSlug: finalSlug,
          atsUrl: normalizedFinalUrl,
        },
      })

      console.log(
        `   ✅ Updated atsSlug="${finalSlug}", atsUrl="${normalizedFinalUrl}"\n`,
      )
      fixedCount++
    } catch (err: any) {
      console.error(
        `   💥 Failed to update company ${c.name}: ${err?.message || err}\n`,
      )
      errorCount++
    }
  }

  console.log('════════════════════════════════════════════')
  console.log(' Lever slug fix complete')
  console.log('════════════════════════════════════════════')
  console.log(`  Updated companies:   ${fixedCount}`)
  console.log(`  Unchanged companies: ${unchangedCount}`)
  console.log(`  Errors:              ${errorCount}`)
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('\n💥 Script failed:', err)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
