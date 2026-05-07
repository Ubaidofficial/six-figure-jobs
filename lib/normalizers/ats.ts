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
 * Supported providers (stable):
 * ✔ Greenhouse
 * ✔ Lever
 * ✔ Ashby
 * ✔ Workday
 * ✔ SmartRecruiters
 * ✔ Recruitee
 * ✔ Workable
 *
 * BambooHR / Breezy / Teamtailor stay excluded until their
 * public scraping path is stable.
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

  // ---------------- Greenhouse ----------------
  // e.g. https://boards.greenhouse.io/figma/jobs/1234567
  if (host === 'boards.greenhouse.io') {
    const parts = path.split('/').filter(Boolean) // ["figma", "jobs", "1234567"]
    const boardSlug = parts[0]
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
    url.search = ''
    url.hash = ''
    const atsUrl = url.toString().replace(/\/$/, '')
    return { provider: 'workday', atsUrl }
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

  // Not detected
  return null
}
