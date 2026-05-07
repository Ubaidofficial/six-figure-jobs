// lib/scrapers/h1bVisaScraper.ts
// Scrapes H1B visa sponsorship job listings from:
//   - h1bvisajobs.com  (DOL LCA-based aggregator)
//   - myvisajobs.com   (DOL LCA-based aggregator)
//
// These sites pull from DOL OFLC public disclosure data and show
// companies that have filed H1B petitions with wage/role info.
// We scrape them to populate the visa sponsorship tag on jobs.

import * as cheerio from 'cheerio'
import { ingestBoardJob } from '../jobs/ingestBoardJob'
import type { ScraperStats } from './scraperStats'

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
}

async function fetchHtml(url: string, timeoutMs = 20000): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { headers: DEFAULT_HEADERS, signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) {
      console.warn(`[h1bVisa] HTTP ${res.status} for ${url}`)
      return null
    }
    return await res.text()
  } catch (err: any) {
    console.warn(`[h1bVisa] Fetch error for ${url}: ${err?.message}`)
    return null
  }
}

// ---------------------------------------------------------------------------
// h1bvisajobs.com scraper
// URL pattern: https://h1bvisajobs.com/h1b-job/[role]-jobs.html
// Pagination:  ?p=2, ?p=3, ...
// ---------------------------------------------------------------------------

const H1B_VISA_JOBS_ROLES = [
  'software-engineer',
  'data-engineer',
  'data-scientist',
  'machine-learning-engineer',
  'backend-engineer',
  'frontend-engineer',
  'product-manager',
  'devops-engineer',
  'full-stack-engineer',
]

async function scrapeH1bVisaJobsPage(url: string): Promise<
  Array<{
    title: string
    company: string
    location: string
    salary: string | null
    detailUrl: string
  }>
> {
  const html = await fetchHtml(url)
  if (!html) return []

  const $ = cheerio.load(html)
  const jobs: Array<{
    title: string
    company: string
    location: string
    salary: string | null
    detailUrl: string
  }> = []

  // h1bvisajobs.com uses a table layout with rows for each job
  // Try multiple selector patterns to be resilient to site changes
  const rows = $('table tr, .job-row, .job-listing, .result-row, article.job').toArray()

  for (const row of rows) {
    const $row = $(row)
    const cells = $row.find('td').toArray()

    // Table row with at least 3 cells (title, company, location)
    if (cells.length >= 3) {
      const titleCell = $(cells[0])
      const companyCell = $(cells[1])
      const locationCell = $(cells[2])
      const salaryCell = cells[3] ? $(cells[3]) : null

      const title = titleCell.find('a').first().text().trim() || titleCell.text().trim()
      const detailHref = titleCell.find('a').first().attr('href') || ''
      const company = companyCell.find('a').first().text().trim() || companyCell.text().trim()
      const location = locationCell.text().trim()
      const salary = salaryCell?.text().trim() || null

      if (title && company && detailHref) {
        const detailUrl = detailHref.startsWith('http')
          ? detailHref
          : `https://h1bvisajobs.com${detailHref}`
        jobs.push({ title, company, location, salary, detailUrl })
      }
      continue
    }

    // Card/list layout fallback
    const titleEl = $row.find('h2 a, h3 a, .title a, .job-title a').first()
    const title = titleEl.text().trim()
    const detailHref = titleEl.attr('href') || ''
    const company = $row.find('.company, .employer, .company-name').first().text().trim()
    const location = $row.find('.location, .city, .loc').first().text().trim()
    const salary =
      $row.find('.salary, .wage, .compensation').first().text().trim() || null

    if (title && company && detailHref) {
      const detailUrl = detailHref.startsWith('http')
        ? detailHref
        : `https://h1bvisajobs.com${detailHref}`
      jobs.push({ title, company, location, salary, detailUrl })
    }
  }

  return jobs
}

export async function scrapeH1bVisaJobs(): Promise<ScraperStats> {
  console.log('[h1bVisaJobs] Starting scrape...')
  const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

  for (const role of H1B_VISA_JOBS_ROLES) {
    const baseUrl = `https://h1bvisajobs.com/h1b-job/${role}-jobs.html`
    console.log(`[h1bVisaJobs] Scraping role: ${role}`)

    // Scrape first 2 pages per role
    for (let page = 1; page <= 2; page++) {
      const url = page === 1 ? baseUrl : `${baseUrl}?p=${page}`
      const jobs = await scrapeH1bVisaJobsPage(url)

      if (jobs.length === 0) break

      for (const job of jobs) {
        try {
          const parsedSalary = parseSalaryText(job.salary)
          const result = await ingestBoardJob('h1bvisajobs', {
            externalId: job.detailUrl,
            title: job.title,
            url: job.detailUrl,
            applyUrl: job.detailUrl,
            rawCompanyName: job.company,
            locationText: job.location,
            ...parsedSalary,
            isRemote: null,
            postedAt: null,
          })

          if (result === 'new') stats.created++
          else if (result === 'updated') stats.updated++
          else stats.skipped++
        } catch (err: any) {
          console.warn(`[h1bVisaJobs] Error ingesting job "${job.title}": ${err?.message}`)
          stats.skipped++
        }
      }

      // Polite delay between pages
      await sleep(800)
    }

    await sleep(1200)
  }

  console.log(`[h1bVisaJobs] Done: ${stats.created} new, ${stats.updated} updated, ${stats.skipped} skipped`)
  return stats
}

// ---------------------------------------------------------------------------
// myvisajobs.com scraper
// URL: https://www.myvisajobs.com/H1B_Sponsor_Visa/[Role]/J_NW.htm
// ---------------------------------------------------------------------------

const MY_VISA_JOBS_ROLES = [
  { slug: 'Software_Engineer', label: 'software engineer' },
  { slug: 'Data_Engineer', label: 'data engineer' },
  { slug: 'Data_Scientist', label: 'data scientist' },
  { slug: 'Product_Manager', label: 'product manager' },
  { slug: 'Software_Developer', label: 'software developer' },
  { slug: 'Machine_Learning_Engineer', label: 'machine learning engineer' },
  { slug: 'DevOps_Engineer', label: 'devops engineer' },
]

async function scrapeMyVisaJobsPage(url: string): Promise<
  Array<{
    title: string
    company: string
    location: string
    salary: string | null
    detailUrl: string
  }>
> {
  const html = await fetchHtml(url)
  if (!html) return []

  const $ = cheerio.load(html)
  const jobs: Array<{
    title: string
    company: string
    location: string
    salary: string | null
    detailUrl: string
  }> = []

  // myvisajobs.com uses a table with rows for LCA filings
  $('table.tbl tr, table tr').each((i, row) => {
    if (i === 0) return // Skip header row
    const $row = $(row)
    const cells = $row.find('td').toArray()
    if (cells.length < 3) return

    const titleCell = $(cells[0])
    const companyCell = $(cells[1])
    const locationCell = $(cells[2])
    const salaryCell = cells[3] ? $(cells[3]) : null

    const titleLink = titleCell.find('a').first()
    const title = titleLink.text().trim() || titleCell.text().trim()
    const detailHref = titleLink.attr('href') || ''
    const company =
      companyCell.find('a').first().text().trim() || companyCell.text().trim()
    const location = locationCell.text().trim()
    const salary = salaryCell?.text().trim() || null

    if (title && company) {
      const detailUrl = detailHref.startsWith('http')
        ? detailHref
        : detailHref
        ? `https://www.myvisajobs.com${detailHref}`
        : `https://www.myvisajobs.com/H1B_Sponsor_Visa/`
      jobs.push({ title, company, location, salary, detailUrl })
    }
  })

  return jobs
}

export async function scrapeMyVisaJobs(): Promise<ScraperStats> {
  console.log('[myVisaJobs] Starting scrape...')
  const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

  for (const role of MY_VISA_JOBS_ROLES) {
    const url = `https://www.myvisajobs.com/H1B_Sponsor_Visa/${role.slug}/J_NW.htm`
    console.log(`[myVisaJobs] Scraping role: ${role.label}`)

    const jobs = await scrapeMyVisaJobsPage(url)

    for (const job of jobs) {
      try {
        const parsedSalary = parseSalaryText(job.salary)
        const result = await ingestBoardJob('myvisajobs', {
          externalId: `${job.company}::${job.title}::${job.location}`,
          title: job.title,
          url: job.detailUrl,
          applyUrl: job.detailUrl,
          rawCompanyName: job.company,
          locationText: job.location,
          ...parsedSalary,
          isRemote: null,
          postedAt: null,
        })

        if (result === 'new') stats.created++
        else if (result === 'updated') stats.updated++
        else stats.skipped++
      } catch (err: any) {
        console.warn(`[myVisaJobs] Error ingesting job "${job.title}": ${err?.message}`)
        stats.skipped++
      }
    }

    await sleep(1000)
  }

  console.log(`[myVisaJobs] Done: ${stats.created} new, ${stats.updated} updated, ${stats.skipped} skipped`)
  return stats
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSalaryText(raw: string | null): {
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
} {
  if (!raw) return {}
  // Match patterns like "$120,000", "$120k", "$120,000 - $150,000"
  const amounts = raw.match(/\$[\d,]+(?:k)?/gi) ?? []
  const parsed = amounts
    .map((s) => {
      const clean = s.replace(/[$,]/g, '').toLowerCase()
      const val = clean.endsWith('k') ? parseFloat(clean) * 1000 : parseFloat(clean)
      return Number.isFinite(val) && val > 30_000 ? val : null
    })
    .filter((v): v is number => v !== null)

  if (parsed.length === 0) return {}
  if (parsed.length === 1) return { salaryMin: parsed[0], salaryCurrency: 'USD' }
  return { salaryMin: Math.min(...parsed), salaryMax: Math.max(...parsed), salaryCurrency: 'USD' }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
