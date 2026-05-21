import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { SUPPORTED_ATS_PROVIDERS } from '../lib/scrapers/ats/types'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()
const WRITE = process.argv.includes('--write')
const supported = new Set<string>(SUPPORTED_ATS_PROVIDERS)

type CompanyRow = {
  id: string
  name: string
  slug: string
  atsProvider: string | null
  atsUrl: string | null
}

type CompanyAtsRow = {
  id: string
  companyName: string
  companySlug: string
  atsType: string
  atsUrl: string
  isActive: boolean
}

async function loadUnsupportedCompanies() {
  const rows = await prisma.company.findMany({
    where: {
      atsProvider: {
        not: null,
        notIn: [...SUPPORTED_ATS_PROVIDERS],
      },
      atsUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      atsProvider: true,
      atsUrl: true,
    },
    orderBy: [{ atsProvider: 'asc' }, { name: 'asc' }],
  })

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.atsProvider || 'null'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return {
    rows,
    counts,
  }
}

async function loadUnsupportedCompanyAts() {
  const rows = await prisma.companyATS.findMany({
    where: {
      isActive: true,
      atsType: {
        notIn: [...SUPPORTED_ATS_PROVIDERS],
      },
    },
    select: {
      id: true,
      companyName: true,
      companySlug: true,
      atsType: true,
      atsUrl: true,
      isActive: true,
    },
    orderBy: [{ atsType: 'asc' }, { companyName: 'asc' }],
  })

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.atsType] = (acc[row.atsType] || 0) + 1
    return acc
  }, {})

  return {
    rows,
    counts,
  }
}

function printCounts(label: string, counts: Record<string, number>) {
  __slog(label)
  const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))
  if (!entries.length) {
    __slog('  none')
    return
  }
  for (const [key, count] of entries) {
    __slog(`  ${key}: ${count}`)
  }
}

function printCompanySamples(rows: CompanyRow[]) {
  if (!rows.length) return
  __slog('\nSample Company rows:')
  for (const row of rows.slice(0, 10)) {
    __slog(`  - ${row.name} [${row.atsProvider}] ${row.atsUrl}`)
  }
}

function printCompanyAtsSamples(rows: CompanyAtsRow[]) {
  if (!rows.length) return
  __slog('\nSample CompanyATS rows:')
  for (const row of rows.slice(0, 10)) {
    __slog(`  - ${row.companyName} [${row.atsType}] ${row.atsUrl}`)
  }
}

async function main() {
  __slog('=== Unsupported ATS Metadata Cleanup ===')
  __slog(`mode=${WRITE ? 'write' : 'dry-run'}`)
  __slog(`supported=${[...supported].join(', ')}`)
  __slog('')

  const companies = await loadUnsupportedCompanies()
  const companyAts = await loadUnsupportedCompanyAts()

  printCounts('Unsupported Company.atsProvider counts:', companies.counts)
  printCounts('\nUnsupported active CompanyATS.atsType counts:', companyAts.counts)
  printCompanySamples(companies.rows)
  printCompanyAtsSamples(companyAts.rows)

  if (!WRITE) {
    __slog('\nDry run only. Re-run with --write to apply cleanup.')
    return
  }

  const companyIds = companies.rows.map((row) => row.id)
  const companyAtsIds = companyAts.rows.map((row) => row.id)

  let updatedCompanies = 0
  let updatedCompanyAts = 0

  if (companyIds.length) {
    const result = await prisma.company.updateMany({
      where: { id: { in: companyIds } },
      data: {
        atsProvider: null,
        atsUrl: null,
        atsSlug: null,
        scrapeStatus: 'unsupported_ats_removed',
        scrapeError: 'Unsupported ATS provider removed by maintenance cleanup',
      },
    })
    updatedCompanies = result.count
  }

  if (companyAtsIds.length) {
    const result = await prisma.companyATS.updateMany({
      where: { id: { in: companyAtsIds } },
      data: {
        isActive: false,
      },
    })
    updatedCompanyAts = result.count
  }

  __slog('\nApplied cleanup:')
  __slog(`  Company rows cleared: ${updatedCompanies}`)
  __slog(`  CompanyATS rows deactivated: ${updatedCompanyAts}`)
}

main()
  .catch((error) => {
    __serr('[cleanupUnsupportedAtsMetadata] error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
