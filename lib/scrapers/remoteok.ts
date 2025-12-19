// lib/scrapers/remoteok.ts
// RemoteOK → 100k+ jobs via public API + company ingestion
//
// Uses the shared ingestBoardJob helper, which:
//  - Upserts Company via upsertCompanyFromBoard
//  - Gives priority to ATS/company jobs (board jobs become fallback)
//  - Normalizes salary/location/role, etc.

import { ingestBoardJob } from '../jobs/ingestBoardJob'

const BOARD_NAME = 'remoteok'
const API_URL = 'https://remoteok.com/api'

export default async function scrapeRemoteOK() {
  console.log('Scraping RemoteOK (API)…')

  let json: any[] = []
  try {
    const res = await fetch(API_URL, {
      headers: {
        'User-Agent': 'SixFigureJobs/1.0 (+remoteok-scraper)',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(`[${BOARD_NAME}] HTTP ${res.status} for ${API_URL}`)
      return { jobsNew: 0, jobsUpdated: 0, jobsSkipped: 0 }
    }

    json = await res.json()
  } catch (err: any) {
    console.error(
      `[${BOARD_NAME}] Error fetching ${API_URL}:`,
      err?.message || err,
    )
    return { jobsNew: 0, jobsUpdated: 0, jobsSkipped: 0 }
  }

  if (!Array.isArray(json) || json.length === 0) {
    console.warn(`[${BOARD_NAME}] Empty API response`)
    return { jobsNew: 0, jobsUpdated: 0, jobsSkipped: 0 }
  }

  // First element of RemoteOK API is metadata; jobs start from index 1
  const rawJobs = json.slice(1)

  let jobsNew = 0
  let jobsUpdated = 0
  let jobsSkipped = 0

  const companies = new Set<string>()

  for (const j of rawJobs) {
    try {
      const id = j.id ?? j.slug ?? j.position
      if (!id) continue

      const title = j.position || j.title
      if (!title) continue

      const rawCompanyName: string | null =
        j.company || j.company_name || null

      const urlRaw: string | null = j.url || j.apply_url || null
      if (!urlRaw) continue

      const url = urlRaw.startsWith('http')
        ? urlRaw
        : `https://remoteok.com${urlRaw}`

      const locationText: string | null =
        j.location ||
        j.region ||
        (Array.isArray(j.tags) && j.tags.includes('Worldwide')
          ? 'Worldwide'
          : null)

      // Salary info from API if present
      let salaryMin: number | null = null
      let salaryMax: number | null = null
      let salaryCurrency: string | null = null
      let salaryInterval: string | null = null

      if (j.salary_min != null || j.salary_max != null) {
        salaryMin = j.salary_min != null ? Number(j.salary_min) : null
        salaryMax = j.salary_max != null ? Number(j.salary_max) : null
        salaryCurrency = j.salary_currency || null
        salaryInterval = j.salary_interval || j.salary_type || 'year'
      } else if (j.salary) {
        // We rely on ingestBoardJob.parseSalaryFromText fallback
        // by passing descriptionText below.
        salaryCurrency = null
        salaryInterval = null
      }

      const descriptionHtml: string | null = j.description || null
      const descriptionText: string | null =
        (j.description && stripHtml(j.description)) || null

      const postedAt = j.date ? new Date(j.date) : null

      const result = await ingestBoardJob(BOARD_NAME, {
        externalId: String(id),
        title,
        url,
        rawCompanyName,
        locationText,
        salaryMin,
        salaryMax,
        salaryCurrency,
        salaryInterval,
        isRemote: true,
        employmentType: j.job_type || j.type || null,
        postedAt,
        updatedAt: postedAt,
        descriptionHtml,
        descriptionText,
        companyWebsiteUrl: null,
        applyUrl: url,
        explicitAtsProvider: null,
        explicitAtsUrl: null,
        raw: j,
      })

      if (rawCompanyName) {
        companies.add(rawCompanyName)
      }

      if (result === 'new') jobsNew++
      else if (result === 'updated') jobsUpdated++
      else jobsSkipped++
    } catch (err: any) {
      console.error(
        `[${BOARD_NAME}] Error processing job id=${j?.id}:`,
        err?.message || err,
      )
    }
  }

  console.log(
    `[${BOARD_NAME}] Done: jobsNew=${jobsNew}, jobsUpdated=${jobsUpdated}, jobsSkipped=${jobsSkipped}, uniqueCompanies=${companies.size}`,
  )

  return {
    jobsNew,
    jobsUpdated,
    jobsSkipped,
    companiesSeen: companies.size,
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
