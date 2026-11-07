// Adds the European Greenhouse boards in lib/companies/europeanBoards.ts as Company rows so the daily ATS scrape picks
// them up. Dry run by default: it prints what it would do and writes nothing. Pass --apply to write.
//
// Run through Railway so DATABASE_URL stays server-side:
//   railway run --service six-figure-jobs npx tsx scripts/addEuropeanCompanies.ts
//   railway run --service six-figure-jobs npx tsx scripts/addEuropeanCompanies.ts --apply
//
// Each board is checked live first (Greenhouse's public API) and skipped if it does not answer or has no postings.
// A company that already points at a different ATS board is left alone and reported. Safe to run again.

import { prisma } from '../lib/prisma'
import {
  EUROPEAN_GREENHOUSE_BOARDS,
  boardAtsUrl,
  companySlug,
  findExisting,
  planBoard,
  type EuropeanBoard,
} from '../lib/companies/europeanBoards'

const APPLY = process.argv.includes('--apply')

async function liveJobCount(board: EuropeanBoard): Promise<number | null> {
  try {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board.boardSlug}/jobs`, {
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { jobs?: unknown[] }
    return Array.isArray(body.jobs) ? body.jobs.length : null
  } catch {
    return null
  }
}

async function main() {
  console.log(APPLY ? 'APPLY: writing changes\n' : 'DRY RUN: nothing is written (pass --apply to write)\n')
  const counts = { create: 0, attach: 0, skip: 0, unreachable: 0 }

  for (const board of EUROPEAN_GREENHOUSE_BOARDS) {
    const live = await liveJobCount(board)
    if (!live) {
      counts.unreachable++
      console.log(`${board.name.padEnd(14)} SKIP  board did not answer or has no postings (${boardAtsUrl(board)})`)
      continue
    }

    const rows = await prisma.company.findMany({
      where: {
        OR: [
          { slug: { in: [companySlug(board.name), board.boardSlug] } },
          { name: { equals: board.name, mode: 'insensitive' } },
          { atsUrl: { contains: `greenhouse.io/${board.boardSlug}` } },
        ],
      },
      select: { id: true, slug: true, name: true, atsProvider: true, atsUrl: true },
    })
    const plan = planBoard(board, findExisting(board, rows))

    if (plan.action === 'skip') {
      counts.skip++
      console.log(`${board.name.padEnd(14)} skip  ${plan.reason} (${live} postings live)`)
      continue
    }

    counts[plan.action]++
    console.log(`${board.name.padEnd(14)} ${plan.action.padEnd(6)} ${boardAtsUrl(board)} (${live} postings live)`)
    if (!APPLY) continue
    if (plan.action === 'create') await prisma.company.create({ data: plan.data })
    else await prisma.company.update({ where: { id: plan.id }, data: plan.data })
  }

  console.log(`\ncreate ${counts.create} | attach ${counts.attach} | already fine or points elsewhere ${counts.skip} | unreachable ${counts.unreachable}`)
  if (!APPLY && counts.create + counts.attach > 0) console.log('Run again with --apply to write these.')
  if (APPLY && counts.create + counts.attach > 0) console.log('The next daily ATS scrape will fetch these boards.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
