// lib/scrapers/ats/lever.ts

import type { AtsJob } from './types'

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SixFigureJobs/1.0 (+job-board-scraper)' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Lever fetch failed: ${res.status}`)
  return res.json()
}

/**
 * atsUrl example:
 *   https://jobs.lever.co/figma
 *   https://jobs.lever.co/openai
 */
export async function scrapeLever(atsUrl: string): Promise<AtsJob[]> {
  const url = new URL(atsUrl)
  const companySlug = url.pathname.split('/').filter(Boolean)[0] // jobs.lever.co/<slug>

  if (!companySlug) {
    console.warn(`[Lever] Could not extract company slug from atsUrl=${atsUrl}`)
    return []
  }

  const apiUrl = `https://api.lever.co/v0/postings/${companySlug}?mode=json`
  const data = await fetchJson(apiUrl)

  if (!Array.isArray(data)) {
    console.warn(`[Lever] Unexpected JSON for ${apiUrl}`)
    return []
  }

  const jobs: AtsJob[] = data.map((item: any): AtsJob => {
    const externalId = String(item.id ?? item.slug ?? item.text ?? '')
    const jobUrl =
      item.hostedUrl ??
      item.applyUrl ??
      item.url ??
      `${atsUrl.replace(/\/$/, '')}/${externalId}`

    const locationText: string | null = item.categories?.location ?? null
    const commitment: string | null = item.categories?.commitment ?? null

    // Very rough salary parsing if Lever exposes salary as plain text
    let salaryMin: number | null = null
    let salaryMax: number | null = null
    let salaryCurrency: string | null = null
    let salaryInterval: string | null = null

    const compensationSections: any[] = Array.isArray(item.lists)
      ? item.lists
      : []
    const comp = compensationSections.find((l) =>
      /compensation|salary/i.test((l.text as string) || ''),
    )

    if (comp && typeof comp.content === 'string') {
      const m = comp.content.match(
        /\$?\s*([\d,]+)(?:[^\d]+\$?\s*([\d,]+))?/,
      )
      if (m) {
        salaryMin = Number(m[1].replace(/,/g, ''))
        if (m[2]) {
          salaryMax = Number(m[2].replace(/,/g, ''))
        }
        salaryCurrency = 'USD'
        salaryInterval = 'year'
      }
    }

    const locLower = (locationText || '').toLowerCase()
    const remoteHint =
      locLower.includes('remote') ||
      locLower.includes('anywhere') ||
      locLower.includes('work from home')

    const postedAt = item.createdAt ? new Date(item.createdAt) : null
    const updatedAt = item.updatedAt ? new Date(item.updatedAt) : postedAt

    return {
      externalId,
      title: item.text ?? item.title ?? 'Untitled',
      url: jobUrl,
      locationText,
      remote: remoteHint || null,

      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryInterval,

      employmentType: commitment,
      descriptionHtml: item.description ?? item.descriptionPlain ?? null,
      
      roleSlug: null,
      baseRoleSlug: null,
      seniority: null,
      discipline: null,
      isManager: false,

      postedAt,
      updatedAt,
      raw: item,
    }
  })

  console.log(`[Lever] Fetched ${jobs.length} jobs for slug=${companySlug}`)
  return jobs
}