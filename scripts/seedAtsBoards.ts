// scripts/seedAtsBoards.ts
//
// Seeds `CompanyATS` with the company job boards in scripts/data/atsBoards.json (FTJA's list of boards built from
// OpenJobs and career-ops, both MIT; see THIRD_PARTY_NOTICES.md), so scripts/scrapeDirectATS.ts reads them. Only boards
// we do not already hold (by board URL or company slug) are added.
//
// A dry run unless --apply is passed. Nothing is deleted or changed, only added.
//
// Usage:
//   npx tsx scripts/seedAtsBoards.ts                     # plan only, no network except the database
//   npx tsx scripts/seedAtsBoards.ts --verify            # also ask each new board's public API whether it lists postings
//   npx tsx scripts/seedAtsBoards.ts --verify --apply --vendors=greenhouse,lever --limit=200
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { format as __format } from 'node:util'

import slugify from 'slugify'

import { prisma } from '../lib/prisma'
import { boardTitles, boardUrl, isValidBoard } from '../lib/scrapers/atsBoards'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')

type SeedBoard = { name: string; vendor: string; slug: string; source: string }

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const apply = process.argv.includes('--apply')
const verify = process.argv.includes('--verify')
const vendors = arg('vendors')?.split(',').map((v) => v.trim())
const limit = Number(arg('limit') ?? 0) || Infinity
const DISCOVERED_BY = 'seed:ftja-ats-boards'
const norm = (url: string) => url.trim().toLowerCase().replace(/\/+$/, '')

async function main() {
  const file = JSON.parse(readFileSync(join(__dirname, 'data', 'atsBoards.json'), 'utf8')) as { boards: SeedBoard[] }
  const boards = file.boards.filter((b) => isValidBoard(b.vendor, b.slug) && (!vendors || vendors.includes(b.vendor)))

  const [have, haveCompanies] = await Promise.all([
    prisma.companyATS.findMany({ select: { atsUrl: true, companySlug: true } }),
    prisma.company.findMany({ where: { atsUrl: { not: null } }, select: { atsUrl: true } }),
  ])
  const knownUrls = new Set([...have.map((r) => norm(r.atsUrl)), ...haveCompanies.map((r) => norm(r.atsUrl!))])
  const takenSlugs = new Set(have.map((r) => r.companySlug))

  const stats = { listed: boards.length, alreadyKnown: 0, slugTaken: 0, dead: 0, toAdd: 0 }
  const fresh: Array<SeedBoard & { atsUrl: string; companySlug: string }> = []
  for (const b of boards) {
    const atsUrl = boardUrl(b.vendor as any, b.slug)
    const companySlug = slugify(b.name, { lower: true, strict: true, trim: true })
    if (knownUrls.has(norm(atsUrl))) stats.alreadyKnown++
    else if (!companySlug || takenSlugs.has(companySlug)) stats.slugTaken++
    else {
      takenSlugs.add(companySlug)
      knownUrls.add(norm(atsUrl))
      fresh.push({ ...b, atsUrl, companySlug })
    }
  }

  let keep = fresh.slice(0, limit)
  if (verify) {
    const alive: typeof keep = []
    for (let i = 0; i < keep.length; i += 16) {
      const chunk = keep.slice(i, i + 16)
      const results = await Promise.all(chunk.map((b) => boardTitles(b.vendor as any, b.slug)))
      chunk.forEach((b, n) => (results[n].length ? alive.push(b) : stats.dead++))
    }
    keep = alive
  }
  stats.toAdd = keep.length

  const byVendor: Record<string, number> = {}
  for (const b of keep) byVendor[b.vendor] = (byVendor[b.vendor] ?? 0) + 1
  __slog(`${apply ? 'APPLY' : 'DRY RUN'}${verify ? ' (boards verified live)' : ' (boards NOT verified; add --verify)'}`)
  __slog(JSON.stringify(stats), JSON.stringify(byVendor))
  for (const b of keep.slice(0, 10)) __slog(`  + ${b.name} (${b.vendor}) ${b.atsUrl}`)

  if (apply) {
    let added = 0
    for (let i = 0; i < keep.length; i += 200) {
      const { count } = await prisma.companyATS.createMany({
        data: keep.slice(i, i + 200).map((b) => ({
          companyName: b.name,
          companySlug: b.companySlug,
          atsType: b.vendor,
          atsUrl: b.atsUrl,
          discoveredBy: DISCOVERED_BY,
          isActive: true,
        })),
        skipDuplicates: true,
      })
      added += count
    }
    __slog(`added ${added} CompanyATS rows`)
  }
}

main()
  .catch((err) => {
    process.stderr.write(String(err?.stack ?? err) + '\n')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
