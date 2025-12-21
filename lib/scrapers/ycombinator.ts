// lib/scrapers/ycombinator.ts

import axios from 'axios'
import { upsertBoardJob } from './_boardHelpers'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'

const BOARD = 'ycombinator'
const BASE_URL = 'https://www.ycombinator.com'

async function fetchCompanies(attempt = 1): Promise<any | null> {
  const maxAttempts = 3
  const backoffMs = 2000 * attempt
  try {
    const url = `${BASE_URL}/companies?include=jobs`
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      timeout: 20000,
      validateStatus: (s) => s >= 200 && s < 500,
    })

    if (response.status >= 500) {
      if (attempt >= maxAttempts) return null
      await new Promise((r) => setTimeout(r, backoffMs))
      return fetchCompanies(attempt + 1)
    }

    if (response.status >= 400) {
      console.warn(`YC returned ${response.status}, skipping.`)
      return null
    }

    return response.data
  } catch (err: any) {
    if (attempt >= 3) return null
    await new Promise((r) => setTimeout(r, backoffMs))
    return fetchCompanies(attempt + 1)
  }
}

export default async function scrapeYCombinator() {
  console.log('[YCombinator] Starting scrape...')

  try {
    const data = (await fetchCompanies()) as any
    if (!data) {
      return { created: 0, updated: 0, skipped: 0, error: 'Failed to fetch YC data' } satisfies ScraperStats
    }

    if (!data || !Array.isArray(data.companies)) {
      console.log('YC returned unexpected format for companies:')
      console.log(Object.keys(data || {}))
      return { created: 0, updated: 0, skipped: 0, error: 'unexpected-format' } satisfies ScraperStats
    }

    const companies: any[] = data.companies
    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    for (const company of companies) {
      const jobs: any[] = company.jobs || []
      if (!jobs.length) continue

      for (const job of jobs) {
        const title: string = job.title || ''
        const description: string = job.description || ''

        // REMOVED ML FILTER - get all tech jobs from YC companies
        
        let minSalary = 100
        let maxSalary = 180
        let salaryText = '$100k+ (estimated)'

        // Better salary extraction from compensation object
        if (job.compensation) {
          if (job.compensation.min_salary) {
            minSalary = Math.round(job.compensation.min_salary / 1000)
          }
          if (job.compensation.max_salary) {
            maxSalary = Math.round(job.compensation.max_salary / 1000)
          }
          if (job.compensation.salary) {
            const sal = String(job.compensation.salary).toLowerCase()
            const match = sal.match(/(\d{2,3})k/)
            if (match) {
              minSalary = parseInt(match[1], 10)
              maxSalary = minSalary + 40
            }
          }
          
          if (minSalary && maxSalary) {
            salaryText = `$${minSalary}k - $${maxSalary}k`
          }
        }

        if (minSalary < 100) continue

        let location: string = job.location || 'Remote'
        if (location.toLowerCase().includes('remote')) {
          location = 'Remote'
        }

        const companyName: string = company.name || 'YC company'

        // Better URL construction
        const applyUrl = job.apply_url 
          || (job.url?.startsWith('http') ? job.url : job.url?.startsWith('/') ? `${BASE_URL}${job.url}` : null)
          || `${BASE_URL}/companies/${company.slug || company.id}/jobs/${job.id}`

        const result = await upsertBoardJob({
          board: BOARD,
          externalId: `yc-${job.id}`,
          title,
          company: companyName,
          applyUrl,
          location,
          salaryText,
          remote: location === 'Remote',
          descriptionHtml: description || null,
          descriptionText: description || null,
          raw: {
            ...job,
            company: {
              name: companyName,
              slug: company.slug,
              batch: company.batch,
            }
          }
        })
        addBoardIngestResult(stats, result)
      }
    }

    console.log(`[YCombinator] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[YCombinator] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
