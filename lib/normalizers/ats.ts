// lib/normalizers/ats.ts

import type { AtsProvider } from '../scrapers/ats/types'

export interface DetectedAts {
  provider: AtsProvider
  atsUrl: string
}

/**
 * Phase-2 baseline ATS detection.
 *
 * IMPORTANT:
 * - This file must stay conservative.
 * - Only detect ATS URLs when we are 100% confident.
 * - Do NOT “guess” or build ATS URLs out of weak patterns.
 *
 * Supported providers:
 * ✔ Greenhouse
 * ✔ Lever
 * ✔ Ashby
 * ✔ Workday
 * ✔ BambooHR
 * ✔ SmartRecruiters
 * ✔ Recruitee
 * ✔ Workable
 * ✔ Teamtailor
 * ✔ Breezy
 */
export function detectAtsFromUrl(rawUrl: string | null | undefined): DetectedAts | null {
  if (!rawUrl) return null

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  const path = url.pathname.replace(/\/+$/, '')
  const pathParts = path.split('/').filter(Boolean)
  const hasFileExtension = /\.[a-z0-9]{2,8}$/i.test(pathParts[pathParts.length - 1] || '')

  // ---------------- Greenhouse ----------------
  // e.g. https://boards.greenhouse.io/figma/jobs/1234567
  if (
    host === 'boards.greenhouse.io' ||
    host === 'job-boards.greenhouse.io' ||
    /^job-boards\.[a-z0-9-]+\.greenhouse\.io$/.test(host)
  ) {
    const boardSlug = pathParts[0]
    if (!boardSlug) return null

    const atsUrl = `https://boards.greenhouse.io/${boardSlug}`
    return { provider: 'greenhouse', atsUrl }
  }

  // ---------------- Lever ----------------
  // e.g. https://jobs.lever.co/figma/abcdef
  if (host === 'jobs.lever.co') {
    const parts = path.split('/').filter(Boolean) // ["figma", "abcdef"]
    const companySlug = parts[0]
    if (!companySlug) return null

    const atsUrl = `https://jobs.lever.co/${companySlug}`
    return { provider: 'lever', atsUrl }
  }

  // ---------------- Ashby ----------------
  // e.g. https://jobs.ashbyhq.com/figma/role-id
  if (host === 'jobs.ashbyhq.com') {
    const parts = path.split('/').filter(Boolean) // ["figma", "role-id"]
    const companySlug = parts[0]
    if (!companySlug) return null

    const atsUrl = `https://jobs.ashbyhq.com/${companySlug}`
    return { provider: 'ashby', atsUrl }
  }

  // ---------------- Workday ----------------
  if (host.includes('myworkdayjobs.com') || host.includes('workdayjobs.com')) {
    if (path.includes('/assets/') || hasFileExtension) return null

    const stopSegments = new Set(['job', 'jobs', 'details', 'login', 'apply'])
    const firstStopIndex = pathParts.findIndex((part) => stopSegments.has(part.toLowerCase()))
    const normalizedParts =
      firstStopIndex >= 0 ? pathParts.slice(0, firstStopIndex) : pathParts

    const normalizedPath = normalizedParts.length ? `/${normalizedParts.join('/')}` : ''
    const atsUrl = `${url.origin}${normalizedPath}`.replace(/\/+$/, '')
    if (!atsUrl || atsUrl === url.origin) return { provider: 'workday', atsUrl: url.origin }
    return { provider: 'workday', atsUrl }
  }

  // ---------------- BambooHR ----------------
  if (host.endsWith('.bamboohr.com')) {
    if (pathParts[0]?.toLowerCase() === 'careers') {
      return { provider: 'bamboohr', atsUrl: `${url.origin}/careers` }
    }
    const subdomain = host.replace(/\.bamboohr\.com$/, '')
    if (!subdomain) return null
    return { provider: 'bamboohr', atsUrl: `https://${subdomain}.bamboohr.com` }
  }

  // ---------------- SmartRecruiters ----------------
  // e.g. https://jobs.smartrecruiters.com/Figma/744...
  // e.g. https://careers.smartrecruiters.com/Figma
  if (host === 'jobs.smartrecruiters.com' || host === 'careers.smartrecruiters.com') {
    const parts = path.split('/').filter(Boolean)
    const companySlug = parts[0]
    if (!companySlug) return null

    const atsUrl = `https://jobs.smartrecruiters.com/${companySlug}`
    return { provider: 'smartrecruiters', atsUrl }
  }

  // ---------------- Recruitee ----------------
  // e.g. https://figma.recruitee.com/o/senior-designer
  if (host.endsWith('.recruitee.com')) {
    const atsUrl = `https://${host}`
    return { provider: 'recruitee', atsUrl }
  }

  // ---------------- Workable ----------------
  // e.g. https://apply.workable.com/huggingface/j/0CE9E806CC
  if (host === 'apply.workable.com') {
    const parts = path.split('/').filter(Boolean)
    const accountSlug = parts[0]
    if (!accountSlug) return null

    const atsUrl = `https://apply.workable.com/${accountSlug}`
    return { provider: 'workable', atsUrl }
  }

  // ---------------- Teamtailor ----------------
  if (host.endsWith('teamtailor.com')) {
    url.search = ''
    url.hash = ''
    const atsUrl = `${url.origin}${path || ''}`.replace(/\/+$/, '') || url.origin
    return { provider: 'teamtailor', atsUrl }
  }

  // ---------------- Breezy ----------------
  if (host === 'assets-cdn.breezy.hr') {
    return null
  }

  if (host.endsWith('.breezy.hr')) {
    return { provider: 'breezy', atsUrl: url.origin.replace(/\/+$/, '') }
  }

  if (host === 'breezy.hr' && pathParts[0] === 'companies' && pathParts[1]) {
    return { provider: 'breezy', atsUrl: `https://breezy.hr/companies/${pathParts[1]}` }
  }

  // Not detected
  return null
}
