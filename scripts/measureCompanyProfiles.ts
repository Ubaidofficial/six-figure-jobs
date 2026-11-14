// scripts/measureCompanyProfiles.ts
//
// MEASUREMENT ONLY, writes nothing. Of the companies that have live jobs and a website, how much of a company profile (a
// description, founding year, size, LinkedIn page, country) can their own homepage fill for free? Reads a random sample, fetches
// each homepage once (honest User-Agent, 1.5 s apart; a 403 or 429 skips that company, since each is a different site), parses it
// with lib/companies/profileFromSite.ts and prints fill rates and samples, so the owner can decide whether to build the writer.
//
// Usage: npx tsx scripts/measureCompanyProfiles.ts [--limit=150] [--report=company-profiles.json]
import { writeFileSync } from 'node:fs'
import { format as __format } from 'node:util'

import { parseSiteProfile, type SiteProfile } from '../lib/companies/profileFromSite'
import { prisma } from '../lib/prisma'
import { isKnownBoardHost } from '../lib/scrapers/utils/boardHosts'
import { makePoliteGetter, SourceBlocked } from '../lib/scrapers/utils/politeFetch'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const limit = Number(arg('limit') ?? 150) || 150
const reportPath = arg('report')

function homepage(website: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`)
    if (isKnownBoardHost(url.hostname) || /(^|\.)linkedin\.com$/i.test(url.hostname)) return null
    return `${url.protocol}//${url.host}/`
  } catch {
    return null
  }
}

async function main() {
  const pool = await prisma.company.findMany({
    where: { website: { not: null }, jobs: { some: { isExpired: false } } },
    select: { id: true, name: true, website: true },
    take: 3000,
  })
  // A random sample, so the fill rates are not biased towards the first rows.
  const sample = pool.sort(() => Math.random() - 0.5).slice(0, limit)
  const get = makePoliteGetter({ gapMs: 1500 })

  const counts = { sampled: sample.length, skippedHost: 0, fetched: 0, blockedOrFailed: 0, description: 0, foundingYear: 0, size: 0, linkedin: 0, country: 0, anyField: 0 }
  const rows: Array<{ name: string; site: string } & SiteProfile> = []
  for (const company of sample) {
    const url = homepage(company.website!)
    if (!url) {
      counts.skippedHost++
      continue
    }
    let html: string | null = null
    try {
      html = await get(url)
    } catch (err) {
      if (!(err instanceof SourceBlocked)) html = null
    }
    if (!html) {
      counts.blockedOrFailed++
      continue
    }
    counts.fetched++
    const p = parseSiteProfile(html)
    if (p.description) counts.description++
    if (p.foundingYear) counts.foundingYear++
    if (p.employeeMin) counts.size++
    if (p.linkedinUrl) counts.linkedin++
    if (p.country) counts.country++
    if (Object.keys(p).length) counts.anyField++
    rows.push({ name: company.name, site: url, ...p })
  }

  const pct = (n: number) => (counts.fetched ? `${((n / counts.fetched) * 100).toFixed(0)}%` : 'n/a')
  __slog('MEASUREMENT ONLY, nothing written')
  __slog(JSON.stringify(counts))
  __slog(`of ${counts.fetched} homepages read: description ${pct(counts.description)}, founding year ${pct(counts.foundingYear)}, size ${pct(counts.size)}, LinkedIn ${pct(counts.linkedin)}, country ${pct(counts.country)}, any field ${pct(counts.anyField)}`)
  for (const r of rows.slice(0, 12)) __slog(`  ${r.name} | ${r.site} | ${r.foundingYear ?? '-'} | ${r.employeeMin ?? '-'} | "${(r.description ?? '').slice(0, 110)}"`)
  if (reportPath) writeFileSync(reportPath, JSON.stringify({ counts, rows }, null, 1))
}

main()
  .catch((err) => {
    process.stderr.write(String(err?.stack ?? err) + '\n')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
