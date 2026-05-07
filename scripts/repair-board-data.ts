import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

import { detectAtsFromUrl } from '../lib/normalizers/ats'
import { cleanCompanyName } from '../lib/normalizers/company'
import { boardSourceToHost, hostOf, isKnownBoardHost } from '../lib/scrapers/utils/boardHosts'
import { isExternalToHost } from '../lib/scrapers/utils/detectATS'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()

function isWriteMode() {
  return process.argv.includes('--write')
}

function isInternalBoardApplyUrl(url: string | null | undefined, boardHost: string): boolean {
  const host = hostOf(url)
  return !host || host === boardHost
}

function slugifyCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function looksLikeCareersUrl(url: string): boolean {
  const normalized = String(url || '').toLowerCase()
  return (
    normalized.includes('/careers') ||
    normalized.includes('/jobs') ||
    normalized.includes('/join-us') ||
    normalized.includes('/work-with-us') ||
    normalized.includes('/open-roles')
  )
}

function isUsefulExternalUrl(url: string | null | undefined, boardHost: string): boolean {
  if (!url) return false
  if (!isExternalToHost(url, boardHost)) return false
  const host = hostOf(url)
  if (!host || isKnownBoardHost(host)) return false
  return true
}

type ApplyCandidate = {
  atsUrl: string | null
  website: string | null
}

function resolveFallbackApplyUrl(
  rawCompanyName: string | null,
  boardHost: string,
  companyByName: Map<string, ApplyCandidate>,
  companyBySlug: Map<string, ApplyCandidate>,
  companyAtsByName: Map<string, string>,
  companyAtsBySlug: Map<string, string>,
): string | null {
  const cleaned = cleanCompanyName(rawCompanyName)
  if (!cleaned) return null

  const slug = slugifyCompanyName(cleaned)
  const company =
    companyByName.get(cleaned.toLowerCase()) || (slug ? companyBySlug.get(slug) : null) || null

  if (company?.atsUrl && isUsefulExternalUrl(company.atsUrl, boardHost)) {
    return company.atsUrl
  }

  if (
    company?.website &&
    isUsefulExternalUrl(company.website, boardHost) &&
    (looksLikeCareersUrl(company.website) || detectAtsFromUrl(company.website))
  ) {
    return company.website
  }

  const companyAts =
    companyAtsByName.get(cleaned.toLowerCase()) || (slug ? companyAtsBySlug.get(slug) : null) || null

  if (companyAts && isUsefulExternalUrl(companyAts, boardHost)) {
    return companyAts
  }

  return null
}

async function repairBoardApplyUrls(write: boolean) {
  const [companies, companyAtsRows] = await Promise.all([
    prisma.company.findMany({
      select: {
        name: true,
        slug: true,
        atsUrl: true,
        website: true,
      },
    }),
    prisma.companyATS.findMany({
      where: { isActive: true },
      select: {
        companyName: true,
        companySlug: true,
        atsUrl: true,
      },
    }),
  ])

  const companyByName = new Map<string, ApplyCandidate>()
  const companyBySlug = new Map<string, ApplyCandidate>()
  for (const company of companies) {
    if (company.name) {
      companyByName.set(company.name.toLowerCase(), {
        atsUrl: company.atsUrl,
        website: company.website,
      })
    }
    if (company.slug) {
      companyBySlug.set(company.slug, {
        atsUrl: company.atsUrl,
        website: company.website,
      })
    }
  }

  const companyAtsByName = new Map<string, string>()
  const companyAtsBySlug = new Map<string, string>()
  for (const row of companyAtsRows) {
    if (row.companyName && !companyAtsByName.has(row.companyName.toLowerCase())) {
      companyAtsByName.set(row.companyName.toLowerCase(), row.atsUrl)
    }
    if (row.companySlug && !companyAtsBySlug.has(row.companySlug)) {
      companyAtsBySlug.set(row.companySlug, row.atsUrl)
    }
  }

  const jobs = await prisma.job.findMany({
    where: {
      source: { in: ['board:builtin', 'board:remoteok', 'board:remoterocketship'] },
      isExpired: false,
    },
    select: {
      id: true,
      source: true,
      company: true,
      applyUrl: true,
    },
  })

  let matched = 0
  let updated = 0

  for (const job of jobs) {
    const boardHost = boardSourceToHost(job.source || '')
    if (!boardHost) continue
    if (!isInternalBoardApplyUrl(job.applyUrl, boardHost)) continue

    const fallbackApplyUrl = resolveFallbackApplyUrl(
      job.company,
      boardHost,
      companyByName,
      companyBySlug,
      companyAtsByName,
      companyAtsBySlug,
    )

    if (!fallbackApplyUrl) continue
    matched += 1

    if (write) {
      await prisma.job.update({
        where: { id: job.id },
        data: { applyUrl: fallbackApplyUrl },
      })
      updated += 1
    }
  }

  __slog(
    `[repair-board-data] board apply URLs: matched=${matched} ${write ? `updated=${updated}` : '(dry run)'}`,
  )
}

async function repairCompanyWebsites(write: boolean) {
  const companies = await prisma.company.findMany({
    where: {
      website: { not: null },
    },
    select: {
      id: true,
      name: true,
      website: true,
      atsUrl: true,
    },
  })

  let matched = 0
  let updated = 0

  for (const company of companies) {
    const website = String(company.website || '').trim()
    if (!website) continue

    const websiteHost = hostOf(website)
    if (!websiteHost) continue

    const hasKnownAtsWebsite = Boolean(detectAtsFromUrl(website))
    if (!isKnownBoardHost(websiteHost) && !hasKnownAtsWebsite) continue

    let nextWebsite: string | null = null
    if (company.atsUrl && !isKnownBoardHost(company.atsUrl) && !detectAtsFromUrl(company.atsUrl)) {
      nextWebsite = company.atsUrl
    }

    matched += 1

    if (write) {
      await prisma.company.update({
        where: { id: company.id },
        data: { website: nextWebsite },
      })
      updated += 1
    }
  }

  __slog(
    `[repair-board-data] company websites: matched=${matched} ${write ? `updated=${updated}` : '(dry run)'}`,
  )
}

async function main() {
  const write = isWriteMode()

  __slog(`[repair-board-data] mode=${write ? 'write' : 'dry-run'}`)
  await repairBoardApplyUrls(write)
  await repairCompanyWebsites(write)
}

main()
  .catch((err) => {
    __serr(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
