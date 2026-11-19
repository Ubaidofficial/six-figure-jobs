// scripts/addTopStartupsCompanies.ts
//
// Adds the employer job boards linked from topstartups.io (lib/scrapers/topstartups.ts) as Company rows with
// `atsProvider` and `atsUrl`, so the daily ATS scrape reads them. A row that already points at another board is left
// alone; a row with no ATS settings gets the board attached. Nothing is deleted.
//
// A dry run unless --apply is passed: the dry run reads topstartups.io and the database and prints the plan.
//
// Usage:
//   npx tsx scripts/addTopStartupsCompanies.ts                 # plan only
//   npx tsx scripts/addTopStartupsCompanies.ts --apply         # write
//   npx tsx scripts/addTopStartupsCompanies.ts --max-pages=10  # read only the first 10 listing pages
import { prisma } from '../lib/prisma'
import { companySlug } from '../lib/companies/europeanBoards'
import { collectTopStartupsBoards, findExisting, planBoard } from '../lib/scrapers/topstartups'
import { makePoliteGetter } from '../lib/scrapers/utils/politeFetch'

const APPLY = process.argv.includes('--apply')
const maxPages = Number(process.argv.find((a) => a.startsWith('--max-pages='))?.split('=')[1]) || undefined
const GAP_MS = 2000

/** "greenhouse.io/gusto" from https://boards.greenhouse.io/gusto: matches the board whichever host variant a row stores. */
function boardToken(atsUrl: string): string {
  const u = new URL(atsUrl)
  return `${u.hostname.split('.').slice(-2).join('.')}${u.pathname.replace(/\/+$/, '')}`
}

async function main() {
  console.log(`[topstartups] ${APPLY ? 'APPLY' : 'DRY RUN'}: reading topstartups.io listing pages...`)
  const { boards, pages, blocked } = await collectTopStartupsBoards({ get: makePoliteGetter({ gapMs: GAP_MS }), maxPages })
  console.log(`[topstartups] ${pages} pages, ${boards.length} distinct boards${blocked ? `; STOPPED: ${blocked}` : ''}`)

  const counts = { create: 0, attach: 0, skip: 0, failed: 0 }
  for (const board of boards) {
    const rows = await prisma.company.findMany({
      where: {
        OR: [
          { slug: companySlug(board.name) },
          { name: { equals: board.name, mode: 'insensitive' } },
          { atsUrl: { contains: boardToken(board.atsUrl), mode: 'insensitive' } },
        ],
      },
      select: { id: true, slug: true, name: true, atsProvider: true, atsUrl: true },
    })
    const plan = planBoard(board, findExisting(board, rows))
    if (plan.action === 'skip') {
      counts.skip++
      continue
    }
    console.log(`${plan.action.padEnd(6)} ${board.name} -> ${board.atsUrl}`)
    if (!APPLY) {
      counts[plan.action]++
      continue
    }
    try {
      if (plan.action === 'create') await prisma.company.create({ data: plan.data })
      else await prisma.company.update({ where: { id: plan.id }, data: plan.data })
      counts[plan.action]++
    } catch (err) {
      counts.failed++
      console.error(`[topstartups] could not ${plan.action} ${board.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`\ncreate ${counts.create} | attach ${counts.attach} | already fine or points elsewhere ${counts.skip} | failed ${counts.failed}`)
  if (!APPLY && counts.create + counts.attach > 0) console.log('Run again with --apply to write these.')
  if (APPLY && counts.create + counts.attach > 0) console.log('The next daily ATS scrape will fetch these boards.')
  if (blocked) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
