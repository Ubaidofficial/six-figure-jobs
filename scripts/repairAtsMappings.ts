import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { scrapeCompanyAtsJobs } from '../lib/scrapers/ats'
import { detectAtsFromUrl } from '../lib/normalizers/ats'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()
const WRITE = process.argv.includes('--write')

const SUPPORTED_FALLBACKS = new Set([
  'greenhouse',
  'ashby',
  'smartrecruiters',
  'recruitee',
  'workable',
  'workday',
  'teamtailor',
  'breezy',
])

const PRIORITY: Record<string, number> = {
  greenhouse: 1,
  ashby: 2,
  smartrecruiters: 3,
  recruitee: 4,
  workable: 5,
  workday: 6,
  teamtailor: 7,
  breezy: 8,
}

async function workdayPageLooksReachable(url: string): Promise<boolean> {
  try {
    const normalized = url.split('?')[0]
    const res = await fetch(normalized, {
      method: 'GET',
      headers: {
        'User-Agent': 'SixFigureJobs/1.0 (+ats-repair)',
      },
      redirect: 'follow',
      cache: 'no-store',
    })

    return res.ok
  } catch {
    return false
  }
}

async function repairWorkdayUrls() {
  __slog('Workday URL hydration')

  const companies = await prisma.company.findMany({
    where: { atsProvider: 'workday' },
    select: {
      id: true,
      name: true,
      slug: true,
      atsUrl: true,
    },
    orderBy: { name: 'asc' },
  })

  let updated = 0
  let cleared = 0

  for (const company of companies) {
    const currentUrl = company.atsUrl || ''
    if (currentUrl.includes('/job/') || currentUrl.includes('/details/')) {
      const reachable = await workdayPageLooksReachable(currentUrl)
      if (!reachable) {
        __slog(`  ${company.name}: ${currentUrl} -> clearing unreachable provider`)
        if (WRITE) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              atsProvider: null,
              atsUrl: null,
              atsSlug: null,
              scrapeStatus: 'error',
              scrapeError: 'Workday ATS job URL is unreachable',
            },
          })
        }
        cleared++
        continue
      }

      const validation = await scrapeCompanyAtsJobs('workday', currentUrl)
      if (!validation.success) {
        __slog(`  ${company.name}: ${currentUrl} -> clearing failed scraper (${validation.error})`)
        if (WRITE) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              atsProvider: null,
              atsUrl: null,
              atsSlug: null,
              scrapeStatus: 'error',
              scrapeError: `Workday scraper validation failed: ${validation.error}`,
            },
          })
        }
        cleared++
        continue
      }

      continue
    }

    const fallback = await prisma.companyATS.findFirst({
      where: {
        companySlug: company.slug,
        atsType: 'workday',
        isActive: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

    if (!fallback?.atsUrl) {
      __slog(`  ${company.name}: ${currentUrl} -> clearing provider`)
      if (WRITE) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            atsProvider: null,
            atsUrl: null,
            atsSlug: null,
            scrapeStatus: 'error',
            scrapeError: 'Workday ATS mapping only had a bare origin and no supported fallback path',
          },
        })
      }
      cleared++
      continue
    }

    if (fallback.atsUrl === currentUrl) {
      continue
    }

    __slog(`  ${company.name}: ${currentUrl} -> ${fallback.atsUrl}`)

    if (WRITE) {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          atsUrl: fallback.atsUrl,
          scrapeStatus: null,
          scrapeError: null,
        },
      })
    }

    updated++
  }

  __slog(`  updated: ${updated}`)
  __slog(`  cleared: ${cleared}`)
  __slog('')
}

async function repairLeverMappings() {
  __slog('Lever mapping repair')

  const companies = await prisma.company.findMany({
    where: { atsProvider: 'lever', atsUrl: { not: null } },
    select: {
      id: true,
      name: true,
      slug: true,
      atsUrl: true,
      jobCount: true,
    },
    orderBy: [{ jobCount: 'desc' }, { name: 'asc' }],
  })

  let switched = 0
  let flagged = 0
  let cleared = 0
  let healthy = 0

  for (const company of companies) {
    const result = await scrapeCompanyAtsJobs('lever', company.atsUrl!)
    if (result.success) {
      healthy++
      continue
    }

    const error = result.error.toLowerCase()
    const looksStale =
      error.includes('404') ||
      error.includes('document not found') ||
      error.includes('could not extract')

    if (!looksStale) {
      __slog(`  ${company.name}: transient failure (${result.error})`)
      flagged++
      continue
    }

    const candidates = await prisma.companyATS.findMany({
      where: {
        companySlug: company.slug,
        isActive: true,
      },
      select: {
        atsType: true,
        atsUrl: true,
        discoveredBy: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
    })

    const fallback = candidates
      .filter((candidate) => SUPPORTED_FALLBACKS.has(candidate.atsType))
      .map((candidate) => {
        const detected =
          detectAtsFromUrl(candidate.atsUrl) ||
          (candidate.atsType === 'workday'
            ? { provider: 'workday' as const, atsUrl: candidate.atsUrl }
            : candidate.atsType === 'workable'
              ? { provider: 'workable' as const, atsUrl: candidate.atsUrl }
              : null)

        if (!detected || detected.provider === 'lever') return null

        return {
          provider: detected.provider,
          atsUrl: detected.provider === 'workday' ? candidate.atsUrl : detected.atsUrl,
          discoveredBy: candidate.discoveredBy,
          priority: PRIORITY[detected.provider] ?? 999,
        }
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .sort((a, b) => a.priority - b.priority)[0]

    if (!fallback) {
      __slog(`  ${company.name}: stale lever, clearing provider`)
      if (WRITE) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            atsProvider: null,
            atsUrl: null,
            atsSlug: null,
            scrapeStatus: 'error',
            scrapeError: 'Stale Lever ATS mapping; no supported fallback candidate',
          },
        })
      }
      cleared++
      continue
    }

    __slog(
      `  ${company.name}: lever -> ${fallback.provider} (${fallback.discoveredBy}) ${fallback.atsUrl}`,
    )

    if (WRITE) {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          atsProvider: fallback.provider,
          atsUrl: fallback.atsUrl,
          atsSlug: null,
          scrapeStatus: null,
          scrapeError: null,
        },
      })
    }

    switched++
  }

  __slog(`  healthy:  ${healthy}`)
  __slog(`  switched: ${switched}`)
  __slog(`  cleared:  ${cleared}`)
  __slog(`  flagged:  ${flagged}`)
  __slog('')
}

async function main() {
  __slog(`Repair mode: ${WRITE ? 'WRITE' : 'DRY RUN'}`)
  __slog('')

  await repairWorkdayUrls()
  await repairLeverMappings()
}

main()
  .catch((error) => {
    __serr(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
