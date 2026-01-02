// scripts/fixGreenhouseSlugs.ts
//
// Attempts to fix bad Greenhouse slugs by:
//  1) Following redirects on atsUrl (https://boards.greenhouse.io/<slug>)
//  2) Extracting the final slug from the redirect URL
//  3) Updating Company.atsSlug + Company.atsUrl if changed
//  4) (Optional) Probing the boards-api endpoint and logging status
//
// Run with:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fixGreenhouseSlugs.ts

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

// If true, we will also ping the boards-api endpoint and log status.
// We DO NOT mutate anything based on this flag; it’s just diagnostic.
const CHECK_API_ENDPOINT = true

// Type hint only; Node 18+ has global fetch.
declare const fetch: any

function extractGreenhouseSlug(url: string): string | null {
  try {
    const u = new URL(url)
    // Expect something like /<slug> or /<slug>/something
    const parts = u.pathname.split('/').filter(Boolean)
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
        'User-Agent': 'SixFigureJobs/1.0 (+greenhouse-fix)',
      },
      cache: 'no-store',
    })

    // node-fetch style: res.url is final URL after redirects
    const finalUrl = res.url || url
    return finalUrl
  } catch (err: any) {
    __serr(`  ⚠️ Error resolving ${url}: ${err?.message || err}`)
    return null
  }
}

async function checkBoardsApi(slug: string): Promise<number | null> {
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`
  try {
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'SixFigureJobs/1.0 (+greenhouse-fix)',
      },
      cache: 'no-store',
    })
    return res.status
  } catch (err: any) {
    __serr(
      `  ⚠️ Error hitting boards-api for slug=${slug}: ${err?.message || err}`,
    )
    return null
  }
}

async function main() {
  __slog('🔧 Fixing Greenhouse slugs based on redirects...\n')

  const companies = await prisma.company.findMany({
    where: {
      atsProvider: 'greenhouse',
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

  __slog(`Found ${companies.length} Greenhouse companies to inspect.\n`)

  let fixedCount = 0
  let unchangedCount = 0
  let errorCount = 0

  for (const c of companies) {
    const atsUrl = c.atsUrl as string | null
    if (!atsUrl) continue

    __slog(`▶ ${c.name}`)
    __slog(`   Current atsUrl: ${atsUrl}`)
    __slog(`   Current atsSlug: ${c.atsSlug || '(none)'}`)

    const originalSlug =
      c.atsSlug || extractGreenhouseSlug(atsUrl) || '(unknown)'

    const finalUrl = await resolveFinalUrl(atsUrl)
    if (!finalUrl) {
      __slog('   ❌ Could not resolve final URL, skipping.\n')
      errorCount++
      continue
    }

    const finalSlug = extractGreenhouseSlug(finalUrl)
    if (!finalSlug) {
      __slog(`   ❌ Could not extract slug from final URL: ${finalUrl}\n`)
      errorCount++
      continue
    }

    __slog(`   → Final URL: ${finalUrl}`)
    __slog(`   → Original slug: ${originalSlug}`)
    __slog(`   → Final slug:    ${finalSlug}`)

    let apiStatus: number | null = null
    if (CHECK_API_ENDPOINT) {
      apiStatus = await checkBoardsApi(finalSlug)
      if (apiStatus != null) {
        __slog(`   → boards-api status for "${finalSlug}": ${apiStatus}`)
      }
    }

    // Decide whether to update
    const slugChanged = c.atsSlug !== finalSlug
    const urlChanged = atsUrl !== `https://boards.greenhouse.io/${finalSlug}`

    if (!slugChanged && !urlChanged) {
      __slog('   ✅ Slug/URL already up to date.\n')
      unchangedCount++
      continue
    }

    try {
      await prisma.company.update({
        where: { id: c.id },
        data: {
          atsSlug: finalSlug,
          atsUrl: `https://boards.greenhouse.io/${finalSlug}`,
        },
      })

      __slog(
        `   ✅ Updated atsSlug="${finalSlug}", atsUrl="https://boards.greenhouse.io/${finalSlug}"\n`,
      )
      fixedCount++
    } catch (err: any) {
      __serr(
        `   💥 Failed to update company ${c.name}: ${err?.message || err}\n`,
      )
      errorCount++
    }
  }

  __slog('════════════════════════════════════════════')
  __slog(' Greenhouse slug fix complete')
  __slog('════════════════════════════════════════════')
  __slog(`  Updated companies:   ${fixedCount}`)
  __slog(`  Unchanged companies: ${unchangedCount}`)
  __slog(`  Errors:              ${errorCount}`)
}

if (require.main === module) {
  main()
    .catch((err) => {
      __serr('\n💥 Script failed:', err)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
