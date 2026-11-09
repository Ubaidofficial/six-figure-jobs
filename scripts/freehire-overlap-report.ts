// scripts/freehire-overlap-report.ts
// Read-only. Answers: of the active jobs we currently get only from freehire, how many could our own ATS scrapers
// supply, and how many companies would we still have to discover first?
//   DATABASE_URL=<read-only url> npx tsx scripts/freehire-overlap-report.ts
// It only runs SELECTs (prisma findMany); nothing is written.
import { prisma } from '../lib/prisma'
import { boardNameFor } from '../lib/scrapers/utils/boardHosts'
import { detectATS } from '../lib/scrapers/utils/detectATS'

const SLUG_IN_PATH = new Set(['greenhouse', 'lever', 'ashby', 'workable'])

export type LinkClass = {
  kind: 'ats' | 'board' | 'other'
  /** ats type, or the board name (e.g. "Adzuna"). */
  label: string
  /** `<ats>:<slug>` when the link names the employer's board (jobs.lever.co/acme); null for company-hosted pages. */
  boardKey: string | null
}

/** Where a job's apply link points. gh_jid on a company-hosted careers page means Greenhouse, but names no board. */
export function classifyLink(rawUrl: string | null | undefined): LinkClass {
  const url = String(rawUrl ?? '').replace(/&amp;/g, '&').trim()
  if (!url) return { kind: 'other', label: 'no link', boardKey: null }
  const ats = detectATS(url)
  if (ats !== 'generic') {
    let slug: string | null = null
    if (SLUG_IN_PATH.has(ats)) {
      try {
        slug = new URL(url).pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? null
      } catch {
        slug = null
      }
    }
    return { kind: 'ats', label: ats, boardKey: slug ? `${ats}:${slug}` : null }
  }
  if (/[?&]gh_jid=/.test(url)) return { kind: 'ats', label: 'greenhouse', boardKey: null }
  const board = boardNameFor(url)
  if (board) return { kind: 'board', label: board, boardKey: null }
  return { kind: 'other', label: 'company page / unknown', boardKey: null }
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : '-')

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_PRISMA_URL) {
    throw new Error('Set DATABASE_URL (a read-only connection is enough).')
  }

  const [atsRows, jobs] = await Promise.all([
    prisma.companyATS.findMany({ where: { isActive: true }, select: { companySlug: true, atsType: true, atsUrl: true } }),
    prisma.job.findMany({
      where: { source: 'board:freehire', isExpired: false },
      select: { company: true, companyId: true, applyUrl: true, url: true },
    }),
  ])

  const companyIds = [...new Set(jobs.map((j) => j.companyId).filter((x): x is string => !!x))]
  const companies = await prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, slug: true } })
  const slugById = new Map(companies.map((c) => [c.id, c.slug]))

  const coveredSlugs = new Set(atsRows.map((r) => r.companySlug))
  const coveredBoards = new Set(atsRows.map((r) => classifyLink(r.atsUrl).boardKey).filter((x): x is string => !!x))

  const byLabel = new Map<string, number>()
  const buckets = {
    atsCovered: { jobs: 0, companies: new Set<string>() },
    atsTokenKnown: { jobs: 0, companies: new Set<string>(), boards: new Set<string>() },
    atsNeedsLookup: { jobs: 0, companies: new Set<string>() },
    board: { jobs: 0, companies: new Set<string>() },
    other: { jobs: 0, companies: new Set<string>() },
  }
  const uncoveredByCompany = new Map<string, number>()

  for (const j of jobs) {
    const link = classifyLink(j.applyUrl ?? j.url)
    const name = j.company || '?'
    byLabel.set(`${link.kind}:${link.label}`, (byLabel.get(`${link.kind}:${link.label}`) ?? 0) + 1)
    if (link.kind === 'board') {
      buckets.board.jobs++, buckets.board.companies.add(name)
    } else if (link.kind === 'other') {
      buckets.other.jobs++, buckets.other.companies.add(name)
    } else {
      const slug = j.companyId ? slugById.get(j.companyId) : undefined
      const covered = (link.boardKey && coveredBoards.has(link.boardKey)) || (slug && coveredSlugs.has(slug))
      if (covered) {
        buckets.atsCovered.jobs++, buckets.atsCovered.companies.add(name)
      } else {
        uncoveredByCompany.set(name, (uncoveredByCompany.get(name) ?? 0) + 1)
        if (link.boardKey) {
          buckets.atsTokenKnown.jobs++, buckets.atsTokenKnown.companies.add(name), buckets.atsTokenKnown.boards.add(link.boardKey)
        } else {
          buckets.atsNeedsLookup.jobs++, buckets.atsNeedsLookup.companies.add(name)
        }
      }
    }
  }

  const n = jobs.length
  console.log(`Active board:freehire jobs: ${n}  (companies: ${new Set(jobs.map((j) => j.company)).size})`)
  console.log(`Active CompanyATS rows: ${atsRows.length}\n`)
  console.log('Where the apply links point:')
  for (const [k, v] of [...byLabel].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(34)} ${String(v).padStart(6)}  ${pct(v, n)}`)

  const row = (label: string, b: { jobs: number; companies: Set<string> }) =>
    console.log(`  ${label.padEnd(58)} jobs ${String(b.jobs).padStart(6)} (${pct(b.jobs, n)})  companies ${b.companies.size}`)
  console.log('\nCan our own scrapers supply them?')
  row('ATS link, company already in CompanyATS (should be covered)', buckets.atsCovered)
  row('ATS link, not in CompanyATS, board token is in the link', buckets.atsTokenKnown)
  row('ATS link, not in CompanyATS, company-hosted page (needs lookup)', buckets.atsNeedsLookup)
  row('Aggregator/job-board link (no direct source)', buckets.board)
  row('Employer page / unknown', buckets.other)
  console.log(`  distinct boards we could add straight from the links: ${buckets.atsTokenKnown.boards.size}`)

  const top = [...uncoveredByCompany].sort((a, b) => b[1] - a[1])
  const topShare = top.slice(0, 5).reduce((s, [, v]) => s + v, 0)
  console.log(`\nTop uncovered companies (top 5 = ${pct(topShare, [...uncoveredByCompany.values()].reduce((s, v) => s + v, 0))} of uncovered ATS jobs):`)
  for (const [name, v] of top.slice(0, 15)) console.log(`  ${String(v).padStart(5)}  ${name}`)
  console.log('\nNote: "covered" means we scrape that board, not that every job passes our salary gate.')
}

if (process.argv[1]?.endsWith('freehire-overlap-report.ts')) {
  main()
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
