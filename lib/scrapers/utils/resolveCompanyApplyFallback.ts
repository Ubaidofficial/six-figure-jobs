import { prisma } from '@/lib/prisma'
import { cleanCompanyName } from '@/lib/normalizers/company'
import { SUPPORTED_ATS_PROVIDERS, isSupportedAtsProvider } from '@/lib/scrapers/ats/types'

import { detectAtsFromUrl } from '@/lib/normalizers/ats'

import { hostOf, isKnownBoardHost } from './boardHosts'
import { isExternalToHost } from './detectATS'

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

function isUsefulExternalApplyUrl(url: string | null | undefined, boardHost: string): boolean {
  if (!url) return false
  if (!isExternalToHost(url, boardHost)) return false
  const host = hostOf(url)
  if (!host || isKnownBoardHost(host)) return false
  return true
}

export async function resolveCompanyApplyFallback(input: {
  rawCompanyName?: string | null
  boardHost: string
  currentApplyUrl?: string | null
}): Promise<string | null> {
  const cleanedCompanyName = cleanCompanyName(input.rawCompanyName)
  if (!cleanedCompanyName) return null

  const currentApplyUrl = String(input.currentApplyUrl || '').trim() || null
  if (isUsefulExternalApplyUrl(currentApplyUrl, input.boardHost)) {
    return currentApplyUrl
  }

  const companySlug = slugifyCompanyName(cleanedCompanyName)

  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { name: { equals: cleanedCompanyName, mode: 'insensitive' } },
        ...(companySlug ? [{ slug: companySlug }] : []),
      ],
    },
    select: {
      atsUrl: true,
      website: true,
    },
  })

  if (company?.atsUrl && isUsefulExternalApplyUrl(company.atsUrl, input.boardHost)) {
    return company.atsUrl
  }

  if (
    company?.website &&
    isUsefulExternalApplyUrl(company.website, input.boardHost) &&
    (looksLikeCareersUrl(company.website) || detectAtsFromUrl(company.website))
  ) {
    return company.website
  }

  const companyAts = await prisma.companyATS.findFirst({
    where: {
      isActive: true,
      atsType: {
        in: [...SUPPORTED_ATS_PROVIDERS],
      },
      OR: [
        { companyName: { equals: cleanedCompanyName, mode: 'insensitive' } },
        ...(companySlug ? [{ companySlug }] : []),
      ],
    },
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      atsUrl: true,
      atsType: true,
    },
  })

  if (
    companyAts?.atsUrl &&
    isSupportedAtsProvider(companyAts.atsType) &&
    isUsefulExternalApplyUrl(companyAts.atsUrl, input.boardHost)
  ) {
    return companyAts.atsUrl
  }

  return null
}
