import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

const BOARD_HOSTS: Record<string, string> = {
  remoteok: 'remoteok.com',
  remotive: 'remotive.com',
  himalayayas: 'himalayas.app',
  himalayas: 'himalayas.app',
  remoteleaf: 'remoteleaf.com',
  weworkremotely: 'weworkremotely.com',
  remoterocketship: 'remoterocketship.com',
  remoteotter: 'remoteotter.com',
  trawle: 'trawle.com',
  '4dayweek': '4dayweek.io',
  builtin: 'builtin.com',
  dice: 'dice.com',
  wellfound: 'wellfound.com',
  otta: 'otta.com',
  ycombinator: 'ycombinator.com',
}

function normalizeHost(host: string): string {
  return String(host || '').replace(/^www\./, '').toLowerCase()
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return normalizeHost(new URL(url).hostname)
  } catch {
    return null
  }
}

async function main() {
  __slog('='.repeat(60))
  __slog('SCRAPER HEALTH CHECK')
  __slog('='.repeat(60))

  const sources = await prisma.job.groupBy({
    by: ['source'],
    _count: true,
    where: {
      isHighSalary: true,
      isExpired: false,
    },
    orderBy: { _count: { source: 'desc' } },
  })

  __slog('\nActive high-salary jobs by source:')
  sources.forEach((s) => {
    __slog(`  ${String(s.source).padEnd(28)} ${String(s._count).padStart(6)}`)
  })

  const boardSources = sources
    .map((s) => String(s.source))
    .filter((src) => src.startsWith('board:'))

  __slog('\nApply URL extraction (board sources):')
  for (const src of boardSources) {
    const board = src.replace(/^board:/, '')
    const boardHost = BOARD_HOSTS[board]
    if (!boardHost) {
      __slog(`  ${src.padEnd(28)} (no host mapping)`)
      continue
    }

    const rows = await prisma.job.findMany({
      where: {
        source: src,
        isHighSalary: true,
        isExpired: false,
      },
      select: { applyUrl: true },
    })

    const total = rows.length
    const internal = rows.filter((r) => hostOf(r.applyUrl) === normalizeHost(boardHost)).length
    const external = total - internal
    const pct = total > 0 ? Math.round((external / total) * 100) : 0

    __slog(
      `  ${src.padEnd(28)} ${String(external).padStart(4)}/${String(total).padEnd(4)} extracted (${pct}%)`,
    )
  }

  const companiesBySource = await prisma.companyATS.groupBy({
    by: ['discoveredBy'],
    _count: true,
    orderBy: { _count: { discoveredBy: 'desc' } },
  })

  __slog('\nCompanyATS discoveredBy:')
  companiesBySource.forEach((s) => {
    __slog(`  ${String(s.discoveredBy).padEnd(20)} ${String(s._count).padStart(6)}`)
  })

  const atsByType = await prisma.companyATS.groupBy({
    by: ['atsType'],
    _count: true,
    orderBy: { _count: { atsType: 'desc' } },
  })

  __slog('\nCompanyATS atsType:')
  atsByType.forEach((s) => {
    __slog(`  ${String(s.atsType).padEnd(20)} ${String(s._count).padStart(6)}`)
  })

  __slog('\n' + '='.repeat(60))
}

main()
  .catch((err) => {
    __serr(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

