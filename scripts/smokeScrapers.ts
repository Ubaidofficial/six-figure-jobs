import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'
import { BOARD_SCRAPERS } from '../lib/scrapers/boardRegistry'
import { SUPPORTED_ATS_PROVIDERS, type AtsProvider } from '../lib/scrapers/ats/types'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()
const UA = 'SixFigureJobsBot/1.0 (+https://www.6figjobs.com)'

async function fetchWithTimeout(url: string, timeoutMs = 8000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(id)
    return { ok: res.ok, status: res.status, error: null as string | null }
  } catch (err: any) {
    clearTimeout(id)
    return {
      ok: false,
      status: err?.name === 'AbortError' ? 408 : 500,
      error: err?.message || String(err),
    }
  }
}

async function checkBoardEndpoints() {
  __slog('🌐 Board endpoint smoke check')
  for (const scraper of BOARD_SCRAPERS) {
    const { name, probeUrl: url } = scraper
    const { ok, status, error } = await fetchWithTimeout(url)
    __slog(
      `  ${name.padEnd(22)} ${ok ? 'OK' : 'FAIL'} (status ${status}${error ? `, error=${error}` : ''})`,
    )
  }
  __slog('')
}

async function checkAtsProviders() {
  __slog('🏢 ATS fetch smoke check (no DB writes)')

  try {
    const unsupported = await prisma.company.groupBy({
      by: ['atsProvider'],
      where: {
        atsProvider: {
          not: null,
          notIn: [...SUPPORTED_ATS_PROVIDERS],
        },
        atsUrl: { not: null },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        atsProvider: 'asc',
      },
    })

    if (unsupported.length) {
      __slog(
        `  unsupported ATS metadata present: ${unsupported
          .map((row) => `${row.atsProvider}=${row._count._all}`)
          .join(', ')}`,
      )
    }

    for (const provider of SUPPORTED_ATS_PROVIDERS as readonly AtsProvider[]) {
      const company = await prisma.company.findFirst({
        where: { atsProvider: provider, atsUrl: { not: null } },
        select: { name: true, atsUrl: true },
        orderBy: [{ jobCount: 'desc' }, { updatedAt: 'desc' }],
      })

      if (!company?.atsUrl) {
        __slog(`  ${provider.padEnd(16)} SKIP (no company with atsUrl)`)
        continue
      }

      try {
        const jobs = await scrapeCompanyAtsJobs(provider, company.atsUrl)
        if (!jobs.success) {
          __slog(
            `  ${provider.padEnd(16)} FAIL – ${jobs.error}`,
          )
          continue
        }
        __slog(
          `  ${provider.padEnd(16)} OK – ${jobs.jobs.length} jobs from ${company.name}`,
        )
      } catch (err: any) {
        __slog(
          `  ${provider.padEnd(16)} FAIL – ${err?.message || String(err)}`,
        )
      }
    }
  } catch (err: any) {
    __slog(`  DB SKIP           ${err?.message || String(err)}`)
  }

  __slog('')
}

async function main() {
  await checkBoardEndpoints()
  await checkAtsProviders()
  await prisma.$disconnect()
}

main().catch((err) => {
  __serr(err)
  process.exit(1)
})
