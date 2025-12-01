// scripts/backfillLinkedinHeuristics.ts
// Infer LinkedIn URLs for companies missing linkedinUrl using simple heuristics.
// Usage: npx tsx scripts/backfillLinkedinHeuristics.ts

import { prisma } from '../lib/prisma'

function cleanHost(url?: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`)
    const host = u.hostname.replace(/^www\./i, '')
    return host || null
  } catch {
    return null
  }
}

function guessLinkedIn(host: string, slug?: string | null): string {
  const base = slug?.trim() ? slug : host.split('.')[0]
  return `https://www.linkedin.com/company/${base}`
}

async function main() {
  const batchSize = 500
  let skip = 0
  let totalUpdated = 0

  while (true) {
    const companies = await prisma.company.findMany({
      where: { linkedinUrl: null },
      select: { id: true, name: true, slug: true, website: true },
      skip,
      take: batchSize,
    })

    if (companies.length === 0) break
    console.log(`Batch starting at ${skip}: ${companies.length} companies`)

    for (const c of companies) {
      const host = cleanHost(c.website)
      if (!host && !c.slug) continue
      const li = guessLinkedIn(host ?? '', c.slug ?? null)

      await prisma.company.update({
        where: { id: c.id },
        data: { linkedinUrl: li },
      })
      totalUpdated++
    }

    skip += batchSize
  }

  console.log(`Updated ${totalUpdated} companies with guessed LinkedIn URLs.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
