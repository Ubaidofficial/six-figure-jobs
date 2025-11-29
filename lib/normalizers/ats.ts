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
 * ✔ Workday (safe origin-based detection only)
 *
 * All other providers will be reintroduced in Phase 3 AFTER controlled testing.
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
  // Safe rule:
  // Detect only when host contains myworkdayjobs.com or workdayjobs.com
  // Keep atsUrl = origin only. Do NOT guess tenant paths.
  //
  // Example:
  // https://figma.wd1.myworkdayjobs.com/en-US/FigmaCareerSite/job/...
  //
  if (host.includes('myworkdayjobs.com') || host.includes('workdayjobs.com')) {
    const atsUrl = url.origin
    return { provider: 'workday', atsUrl }
  }

  // Not detected
  return null
}
