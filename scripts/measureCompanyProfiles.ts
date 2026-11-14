// scripts/measureCompanyProfiles.ts
//
// MEASUREMENT ONLY, writes nothing. Of the companies that have live jobs and a website, how much of a company profile (a
// description, founding year, size, LinkedIn page, country) can their own homepage fill for free? Reads a random sample, fetches
// each homepage once (honest User-Agent, 1.5 s apart; a 403 or 429 skips that company, since each is a different site), parses it
// with lib/companies/profileFromSite.ts and prints fill rates and samples, so the owner can decide whether to build the writer.
//
// It also asks Wikidata (by official website, never by name) for founding year and headcount for the same companies, to see
// whether that fills what homepages cannot.
//
// Usage: npx tsx scripts/measureCompanyProfiles.ts [--limit=150] [--report=company-profiles.json]
import { writeFileSync } from 'node:fs'
import { format as __format } from 'node:util'

import { parseSiteProfile, type SiteProfile } from '../lib/companies/profileFromSite'
import { buildWikidataQuery, parseWikidataBindings, siteKey, type WikidataProfile } from '../lib/companies/wikidataProfile'
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

  // Wikidata, one request per 40 companies. A rate limit or error ends the lookup, never retried.
  const wiki = { asked: 0, matched: 0, foundingYear: 0, employees: 0, stopped: null as string | null }
  const wikiByHost = new Map<string, WikidataProfile>()
  const hosts = [...new Set(rows.map((r) => siteKey(r.site)).filter((h): h is string => Boolean(h)))]
  wiki.asked = hosts.length
  for (let i = 0; i < hosts.length; i += 40) {
    if (i > 0) await new Promise((r) => setTimeout(r, 3000))
    try {
      const res = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query: buildWikidataQuery(hosts.slice(i, i + 40)), format: 'json' })}`, {
        headers: { 'User-Agent': 'SixFigureJobsBot/1.0 (+https://www.6figjobs.com)', Accept: 'application/sparql-results+json' },
        signal: AbortSignal.timeout(90_000),
      })
      if (!res.ok) {
        wiki.stopped = `HTTP ${res.status}`
        break
      }
      for (const [h, p] of parseWikidataBindings((await res.json()).results.bindings)) wikiByHost.set(h, p)
    } catch (err) {
      wiki.stopped = err instanceof Error ? err.message : String(err)
      break
    }
  }
  for (const p of wikiByHost.values()) {
    wiki.matched++
    if (p.foundingYear) wiki.foundingYear++
    if (p.employees) wiki.employees++
  }

  const pct = (n: number) => (counts.fetched ? `${((n / counts.fetched) * 100).toFixed(0)}%` : 'n/a')
  __slog('MEASUREMENT ONLY, nothing written')
  __slog(JSON.stringify(counts))
  __slog(`of ${counts.fetched} homepages read: description ${pct(counts.description)}, founding year ${pct(counts.foundingYear)}, size ${pct(counts.size)}, LinkedIn ${pct(counts.linkedin)}, country ${pct(counts.country)}, any field ${pct(counts.anyField)}`)
  const wp = (n: number) => (wiki.asked ? `${((n / wiki.asked) * 100).toFixed(0)}%` : 'n/a')
  __slog(`Wikidata (by website) for ${wiki.asked} companies: matched ${wp(wiki.matched)}, founding year ${wp(wiki.foundingYear)}, headcount ${wp(wiki.employees)}${wiki.stopped ? `; STOPPED: ${wiki.stopped}` : ''}`)
  for (const r of rows.slice(0, 12)) __slog(`  ${r.name} | ${r.site} | ${r.foundingYear ?? '-'} | ${r.employeeMin ?? '-'} | "${(r.description ?? '').slice(0, 110)}"`)
  if (reportPath) writeFileSync(reportPath, JSON.stringify({ counts, wiki, rows }, null, 1))
}

main()
  .catch((err) => {
    process.stderr.write(String(err?.stack ?? err) + '\n')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
