// scripts/discoverCompaniesViaFreehire.ts
//
// For a list of company names: what does freehire know (jobs listed, the employer's own ATS board), and what do WE already
// scrape in the database? Optionally queue the boards we are missing for the ATS scraper.
//
// Per company, status in our database:
//   scraped       an active CompanyATS row, a company ATS url, or an active CompanySource (a careers page)
//   jobs-only     live jobs from other sources (e.g. the freehire import) but no board or careers page of our own
//   no-jobs       the company is known but has no live jobs and no source
//   not-in-db     no company, no ATS row
//
// Safe by default: a dry run unless --apply is passed. With --apply, a company that is not `scraped` and has a board gets a
// CompanyATS row (discoveredBy: freehire-discovery), and each careers-page lead below gets a Company + CompanySource
// (generic_careers_page). Nothing is ever deleted or overwritten. Every board's jobs still pass the usual quality and
// salary gates when the ATS scraper ingests them.
//
// Usage:
//   npx tsx scripts/discoverCompaniesViaFreehire.ts                          # dry run, the built-in list
//   npx tsx scripts/discoverCompaniesViaFreehire.ts --names="Acme,Foo Inc"   # or --file=names.txt (one name per line)
//   npx tsx scripts/discoverCompaniesViaFreehire.ts --apply --report=out.json
import { readFileSync, writeFileSync } from 'node:fs'
import { format as __format } from 'node:util'
import slugify from 'slugify'

import { prisma } from '../lib/prisma'
import { lookupFreehireCompany, type FreehireCompany } from '../lib/scrapers/freehireCompanyBoard'
import { classifyGenericCareerSource } from '../lib/scrapers/utils/companyCareersDiscovery'
import { saveCompanyATS } from '../lib/scrapers/utils/saveCompanyATS'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const apply = process.argv.includes('--apply')

// Public AI companies picked by hand (2026-11-16) because they were not found in this repo's company lists.
const DEFAULT_NAMES = [
  'Applied Intuition', 'Browserbase', 'Celestial AI', 'Chai Discovery', 'Contextual AI', 'Cyera', 'Fal.ai', 'Fireworks AI',
  'Gamma', 'Genspark', 'HeyGen', 'Imbue', 'Jupiter Intelligence', 'Krea', 'Liquid AI', 'Listen Labs', 'Nous Research',
  'OpenEvidence', 'Reka', 'Rogo', 'Safe Superintelligence', 'Sakana AI', 'Skild AI', 'Surge AI', 'Sust Global', 'Sylvera',
  'Tessl', 'Vellum', 'Wayve', 'World Labs',
]

// Companies whose jobs are on their own website, not on an ATS board: read by the generic careers-page scraper.
const CAREERS_LEADS = [{ name: 'SerpApi', website: 'https://serpapi.com', careersUrl: 'https://serpapi.com/careers' }]

type Status = 'scraped' | 'jobs-only' | 'no-jobs' | 'not-in-db'
type Row = {
  name: string
  status: Status
  detail: string
  freehire: Pick<FreehireCompany, 'slug' | 'jobCount' | 'website'> | null
  board: FreehireCompany['board']
  action: string
}

const host = (url: string | null) => {
  try {
    return new URL(url ?? '').hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

async function dbStatus(name: string, website: string | null, boardUrl: string | null): Promise<{ status: Status; detail: string }> {
  const site = host(website)
  const [ats, company] = await Promise.all([
    prisma.companyATS.findFirst({
      where: { OR: [{ companyName: { equals: name, mode: 'insensitive' } }, ...(boardUrl ? [{ atsUrl: { in: [boardUrl, `${boardUrl}/`] } }] : [])] },
      select: { atsUrl: true, isActive: true },
    }),
    prisma.company.findFirst({
      where: { OR: [{ name: { equals: name, mode: 'insensitive' } }, ...(site ? [{ website: { contains: site, mode: 'insensitive' as const } }] : [])] },
      select: { id: true, atsUrl: true, sources: { where: { isActive: true }, select: { sourceType: true } } },
    }),
  ])
  const own = [
    ...(ats?.isActive ? [`ATS ${ats.atsUrl}`] : []),
    ...(company?.atsUrl ? [`company ATS ${company.atsUrl}`] : []),
    ...(company?.sources.length ? [`${company.sources.length} source(s): ${[...new Set(company.sources.map((s) => s.sourceType))].join(',')}`] : []),
  ]
  if (own.length) return { status: 'scraped', detail: own.join('; ') }
  if (!company) return { status: 'not-in-db', detail: '' }
  const bySource = await prisma.job.groupBy({ by: ['source'], where: { companyId: company.id, isExpired: false }, _count: { _all: true } })
  if (!bySource.length) return { status: 'no-jobs', detail: 'company exists' }
  return { status: 'jobs-only', detail: bySource.map((g) => `${g.source}: ${g._count._all}`).join(', ') }
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name, { lower: true, strict: true, trim: true }) || 'company'
  for (let i = 0; i < 25; i++) {
    const slug = i ? `${base}-${i + 1}` : base
    if (!(await prisma.company.findUnique({ where: { slug }, select: { id: true } }))) return slug
  }
  return `${base}-${Date.now()}`
}

async function main() {
  const fileNames = arg('file') ? readFileSync(arg('file')!, 'utf8').split('\n') : null
  const names = [...new Set((arg('names')?.split(',') ?? fileNames ?? DEFAULT_NAMES).map((n) => n.trim()).filter(Boolean))]
  __slog(`${apply ? 'APPLY' : 'DRY RUN'}: ${names.length} companies, ${CAREERS_LEADS.length} careers-page lead(s)\n`)

  const rows: Row[] = []
  for (const name of names) {
    const fh = await lookupFreehireCompany(name)
    const db = await dbStatus(name, fh?.website ?? null, fh?.board?.url ?? null)
    let action = '-'
    if (db.status !== 'scraped') {
      if (fh?.board) {
        action = apply ? `saved ${fh.board.url}` : `would save ${fh.board.url}`
        if (apply) await saveCompanyATS(name, fh.board.url, 'freehire-discovery')
      } else {
        action = fh ? 'no supported board in freehire jobs: needs a manual look' : 'not in freehire: needs a manual look'
      }
    }
    rows.push({ name, ...db, freehire: fh && { slug: fh.slug, jobCount: fh.jobCount, website: fh.website }, board: fh?.board ?? null, action })
    __slog(`${name.padEnd(24)} ${db.status.padEnd(10)} freehire=${fh ? String(fh.jobCount).padEnd(4) : 'none'} ${db.detail ? `[${db.detail}] ` : ''}${action}`)
  }

  for (const lead of CAREERS_LEADS) {
    const check = classifyGenericCareerSource(lead.careersUrl, lead.website)
    if (!check.valid) {
      __slog(`${lead.name.padEnd(24)} SKIPPED: ${lead.careersUrl} is not a valid careers source (${check.reason})`)
      continue
    }
    const company = await prisma.company.findFirst({ where: { OR: [{ name: { equals: lead.name, mode: 'insensitive' } }, { website: { contains: host(lead.website)!, mode: 'insensitive' } }] }, select: { id: true } })
    const source = company && (await prisma.companySource.findFirst({ where: { companyId: company.id, url: check.normalizedUrl! }, select: { id: true } }))
    if (source) {
      __slog(`${lead.name.padEnd(24)} scraped    careers source already present`)
      continue
    }
    if (apply) {
      const id = company?.id ?? (await prisma.company.create({ data: { name: lead.name, website: lead.website, slug: await uniqueSlug(lead.name) }, select: { id: true } })).id
      await prisma.companySource.create({ data: { companyId: id, url: check.normalizedUrl!, sourceType: 'generic_careers_page', isActive: true } })
    }
    __slog(`${lead.name.padEnd(24)} ${company ? 'company exists' : 'not-in-db'} ${apply ? 'saved' : 'would save'} generic_careers_page ${check.normalizedUrl}`)
  }

  const count = (s: Status) => rows.filter((r) => r.status === s).length
  __slog(`\nscraped ${count('scraped')} · jobs-only ${count('jobs-only')} · no-jobs ${count('no-jobs')} · not-in-db ${count('not-in-db')} · with a board to add ${rows.filter((r) => r.status !== 'scraped' && r.board).length}`)
  if (arg('report')) writeFileSync(arg('report')!, JSON.stringify(rows, null, 2))
  if (!apply) __slog('Dry run: nothing was written. Pass --apply to save.')
}

main()
  .catch((e) => {
    __slog('FAILED:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
