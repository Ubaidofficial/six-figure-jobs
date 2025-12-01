// lib/scrapers/ycombinator.ts

import axios from 'axios'
import { upsertBoardJob } from './_boardHelpers'

const BOARD = 'ycombinator'
const BASE_URL = 'https://www.ycombinator.com'

async function fetchCompanies(attempt = 1): Promise<any | null> {
  const maxAttempts = 3
  const backoffMs = 2000 * attempt
  try {
    const url = `${BASE_URL}/companies?include=jobs`
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      timeout: 20000,
      validateStatus: (s) => s >= 200 && s < 500, // allow 429/500 handling below
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
  try {
    console.log('▶ Scraping Y Combinator Startup Jobs…')

    const data = (await fetchCompanies()) as any
    if (!data) {
      return { board: BOARD, found: 0, stored: 0, error: 'Failed to fetch YC data' }
    }

    if (!data || !Array.isArray(data.companies)) {
      console.log('YC returned unexpected format for companies:')
      console.log(Object.keys(data || {}))
      return { board: BOARD, found: 0, stored: 0 }
    }

    const companies: any[] = data.companies

    const mlKeywords = [
      'machine learning',
      ' ml ',
      'artificial intelligence',
      ' ai ',
      'deep learning',
      'data scientist',
      'computer vision',
      'nlp',
      'llm',
      'generative ai',
      'gen ai',
      'ai engineer',
      'ml engineer',
      'research engineer',
    ]

    let found = 0
    let stored = 0

    for (const company of companies) {
      const jobs: any[] = company.jobs || []
      if (!jobs.length) continue

      for (const job of jobs) {
        const title: string = job.title || ''
        const description: string = job.description || ''
        const combinedText = (title + ' ' + description).toLowerCase()

        const isMLJob = mlKeywords.some((kw) => combinedText.includes(kw))
        if (!isMLJob) continue

        found++

        // --- Salary estimation (very rough) --------------------
        let minSalary = 100
        let maxSalary = 180
        let salaryText = '$100k+ (estimated)'

        if (job.compensation && job.compensation.salary) {
          const sal = String(job.compensation.salary).toLowerCase()
          const match = sal.match(/(\d{2,3})k/)
          if (match) {
            minSalary = parseInt(match[1], 10)
            maxSalary = minSalary + 40
            salaryText = `$${minSalary}k - $${maxSalary}k`
          }
        }

        // Skip clearly sub-100k roles
        if (minSalary < 100) continue

        // --- Location handling ---------------------------------
        let location: string = job.location || 'Remote'
        if (location.toLowerCase().includes('remote')) {
          location = 'Remote'
        }

        const companyName: string = company.name || 'YC company'

        // YC job URLs are relative; prefix with BASE_URL
        const applyUrl =
          job.url && job.url.startsWith('/')
            ? `${BASE_URL}${job.url}`
            : `${BASE_URL}/companies/${company.slug || ''}`

        await upsertBoardJob({
          board: BOARD,
          externalId: `yc-${job.id}`,
          title,
          company: companyName,
          applyUrl,
          location,
          salaryText,
          remote: location === 'Remote',
        })

        stored++
      }
    }

    console.log(`✅ Y Combinator: Found ${found} AI/ML jobs, upserted ${stored}`)

    return {
      board: BOARD,
      found,
      stored,
    }
  } catch (err: any) {
    console.error('YC scraper error:', err?.message ?? err)
    return { board: BOARD, found: 0, stored: 0, error: String(err) }
  }
}
