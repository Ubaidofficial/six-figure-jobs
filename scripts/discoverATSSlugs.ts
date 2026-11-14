// scripts/discoverATSSlugs.ts
//
// Finds the public job board (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Teamtailor) of companies
// that have none recorded, by guessing board names from the company name (lib/scrapers/atsBoards.ts).
//
// A guessed name can belong to ANOTHER company, so a board is saved only when it lists a posting whose title matches one
// we already hold for that company from another source. Boards that list postings but match nothing are printed as
// "unconfirmed" and not saved; check those by hand.
//
// Usage: npx tsx scripts/discoverATSSlugs.ts [--limit=200]
import { format as __format } from 'node:util'

import { PrismaClient } from '@prisma/client'

import { probeBoard } from '../lib/scrapers/atsBoards'
import { saveCompanyATS } from '../lib/scrapers/utils/saveCompanyATS'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")

const prisma = new PrismaClient()
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? 200) || 200

async function main() {
  const companies = await prisma.company.findMany({
    where: { atsUrl: null, name: { not: { contains: 'Jobs Posted' } } },
    take: limit,
  })

  __slog(`\n🔍 Testing ${companies.length} companies...\n`)
  let found = 0
  let unconfirmed = 0

  for (const c of companies) {
    process.stdout.write(`${c.name.slice(0, 25).padEnd(25)} `)
    const known = await prisma.job.findMany({
      where: { companyId: c.id },
      select: { title: true },
      distinct: ['title'],
      take: 50,
    })
    const match = await probeBoard(c.name, known.map((j) => j.title))
    if (!match) {
      __slog('✗')
    } else if (!match.confirmed) {
      __slog(`? ${match.vendor} ${match.url} (${match.postings} postings, none match our titles; not saved)`)
      unconfirmed++
    } else {
      await prisma.company.update({ where: { id: c.id }, data: { atsUrl: match.url, atsProvider: match.vendor } })
      await saveCompanyATS(c.name, match.url, 'discoverATSSlugs')
      __slog(`✓ ${match.vendor} ${match.url}`)
      found++
    }
  }

  __slog(`\n✅ Found ${found} confirmed boards, ${unconfirmed} unconfirmed (not saved)`)
  const total = await prisma.company.count({ where: { atsUrl: { not: null } } })
  __slog(`Total with ATS: ${total}\n`)
  await prisma.$disconnect()
}
main()
