import { format as __format } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()

const ROOT = process.cwd()

const SOURCE_FILES = [
  'scripts/seedTopCompanies.ts',
  'scripts/seed.ts',
  'scripts/addMissingCompanies.ts',
  'scripts/addMoreCompanies.ts',
  'scripts/addRemoteCompanies.ts',
  'prisma/seed-remote-companies.ts',
] as const

function countCompanyEntries(filePath: string, marker?: string): number {
  const fullPath = path.join(ROOT, filePath)
  const text = fs.readFileSync(fullPath, 'utf8')

  if (!marker) {
    return (text.match(/\{ name:/g) || []).length
  }

  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.includes(marker))
  if (start === -1) return 0

  const end = lines.findIndex(
    (line, index) =>
      index > start &&
      line.startsWith('// ---------------------------------------------------------------------------') &&
      lines[index + 1]?.includes('MAIN'),
  )

  return lines
    .slice(start, end === -1 ? undefined : end)
    .filter((line) => line.includes('{ name:'))
    .length
}

async function main() {
  __slog('=== Company Source Audit ===')
  __slog('')

  for (const file of SOURCE_FILES) {
    const total =
      file === 'scripts/seed.ts'
        ? undefined
        : countCompanyEntries(file)

    if (file === 'scripts/seed.ts') {
      const curated = countCompanyEntries(file, 'const COMPANIES')
      const discovery = countCompanyEntries(file, 'const DISCOVERY_COMPANIES')
      __slog(`${file}`)
      __slog(`  curated:   ${curated}`)
      __slog(`  discovery: ${discovery}`)
      __slog(`  total:     ${curated + discovery}`)
      continue
    }

    __slog(`${file}`)
    __slog(`  total: ${total}`)
  }

  __slog('')

  const [totalCompanies, withAts, noAts, noAtsWithWebsite, noAtsSample] =
    await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { atsUrl: { not: null } } }),
      prisma.company.count({ where: { atsUrl: null } }),
      prisma.company.count({ where: { atsUrl: null, website: { not: null } } }),
      prisma.company.findMany({
        where: { atsUrl: null },
        select: { name: true, website: true, jobCount: true },
        orderBy: [{ jobCount: 'desc' }, { updatedAt: 'desc' }],
        take: 20,
      }),
    ])

  __slog('Database inventory')
  __slog(`  total companies:        ${totalCompanies}`)
  __slog(`  companies with ATS:     ${withAts}`)
  __slog(`  companies without ATS:  ${noAts}`)
  __slog(`  non-ATS with website:   ${noAtsWithWebsite}`)
  __slog('')
  __slog('Top non-ATS discovery pool sample')
  for (const company of noAtsSample) {
    __slog(
      `  ${String(company.name).padEnd(32)} jobs=${String(company.jobCount ?? 0).padStart(3)} website=${company.website || '-'}`,
    )
  }
}

main()
  .catch((error) => {
    __serr(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
