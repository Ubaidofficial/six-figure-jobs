// lib/scrapers/utils/saveCompanyATS.ts

import slugify from 'slugify'

import { prisma } from '../../prisma'
import { detectATS, getCompanyJobsUrl, isExternalToHost, type ATSType } from './detectATS'

export async function saveCompanyATS(
  companyName: string,
  jobAtsUrl: string,
  discoveredBy: string,
): Promise<void> {
  const cleanedCompanyName = String(companyName || '').trim()
  if (!cleanedCompanyName) return
  if (cleanedCompanyName.toLowerCase() === 'unknown company') return

  const cleanedJobAtsUrl = String(jobAtsUrl || '').trim()
  if (!cleanedJobAtsUrl) return

  const atsType: ATSType = detectATS(cleanedJobAtsUrl)
  const atsUrl = getCompanyJobsUrl(cleanedJobAtsUrl, atsType).replace(/\/+$/, '')

  let companySlug =
    slugify(cleanedCompanyName, {
      lower: true,
      strict: true,
      trim: true,
    }) || ''

  if (!companySlug) {
    try {
      companySlug = new URL(atsUrl).hostname.split('.')[0].toLowerCase()
    } catch {
      companySlug = 'unknown'
    }
  }

  try {
    await prisma.companyATS.upsert({
      where: { atsUrl },
      update: {
        companyName: cleanedCompanyName,
        companySlug,
        atsType,
        discoveredBy,
        isActive: true,
      },
      create: {
        companyName: cleanedCompanyName,
        companySlug,
        atsType,
        atsUrl,
        discoveredBy,
        isActive: true,
        jobCount: 0,
      },
    })
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : String(err)
    console.error(`[CompanyATS] Error saving ${cleanedCompanyName} (${atsUrl}): ${msg}`)
  }
}

export function isDiscoverableExternalApplyLink(applyUrl: string, boardHost: string): boolean {
  return isExternalToHost(applyUrl, boardHost)
}
