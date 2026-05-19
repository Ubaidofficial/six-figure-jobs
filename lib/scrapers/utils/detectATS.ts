// lib/scrapers/utils/detectATS.ts

import type { AtsProvider } from '../ats/types'

export type ATSType =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'bamboohr'
  | 'smartrecruiters'
  | 'recruitee'
  | 'teamtailor'
  | 'workable'
  | 'breezy'
  | 'icims'
  | 'personio'
  | 'oraclecloud'
  | 'workforcenow'
  | 'jobscore'
  | 'kula'
  | 'gem'
  | 'generic'

export function detectATS(url: string): ATSType {
  const normalized = String(url || '').toLowerCase()

  if (normalized.includes('greenhouse.io') || normalized.includes('boards.greenhouse.io')) {
    return 'greenhouse'
  }

  if (normalized.includes('lever.co') || normalized.includes('jobs.lever.co')) {
    return 'lever'
  }

  if (normalized.includes('ashbyhq.com') || normalized.includes('jobs.ashbyhq.com')) {
    return 'ashby'
  }

  if (normalized.includes('myworkdayjobs.com')) {
    return 'workday'
  }

  if (normalized.includes('bamboohr.com')) {
    return 'bamboohr'
  }

  if (normalized.includes('smartrecruiters.com')) {
    return 'smartrecruiters'
  }

  if (normalized.includes('recruitee.com')) {
    return 'recruitee'
  }

  if (normalized.includes('teamtailor.com')) {
    return 'teamtailor'
  }

  if (normalized.includes('workable.com')) {
    return 'workable'
  }

  if (normalized.includes('breezy.hr')) {
    return 'breezy'
  }

  if (normalized.includes('icims.com')) {
    return 'icims'
  }

  if (normalized.includes('personio.com')) {
    return 'personio'
  }

  if (normalized.includes('oraclecloud.com')) {
    return 'oraclecloud'
  }

  if (normalized.includes('workforcenow.adp.com')) {
    return 'workforcenow'
  }

  if (normalized.includes('jobscore.com')) {
    return 'jobscore'
  }

  if (normalized.includes('kula.ai')) {
    return 'kula'
  }

  if (normalized.includes('gem.com')) {
    return 'gem'
  }

  return 'generic'
}

export function toAtsProvider(atsType: ATSType): AtsProvider | null {
  switch (atsType) {
    case 'greenhouse':
    case 'lever':
    case 'ashby':
    case 'workday':
    case 'bamboohr':
    case 'smartrecruiters':
    case 'recruitee':
    case 'teamtailor':
    case 'workable':
    case 'breezy':
      return atsType
    default:
      return null
  }
}

export function getCompanyJobsUrl(atsUrl: string, atsType: ATSType): string {
  try {
    const url = new URL(atsUrl)
    const pathParts = url.pathname.split('/').filter(Boolean)

    if (atsType === 'greenhouse' || atsType === 'lever' || atsType === 'ashby') {
      const companySlug = pathParts[0]
      return companySlug ? `${url.origin}/${companySlug}` : url.origin
    }

    return url.toString()
  } catch {
    return atsUrl
  }
}

export function isExternalToHost(targetUrl: string, baseHost: string): boolean {
  try {
    const targetHost = new URL(targetUrl).hostname.replace(/^www\./, '').toLowerCase()
    const normalizedBase = String(baseHost || '')
      .replace(/^www\./, '')
      .toLowerCase()
    return targetHost !== normalizedBase
  } catch {
    return false
  }
}
