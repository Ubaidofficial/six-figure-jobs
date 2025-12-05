import type { AtsJob } from './types'
import * as cheerio from 'cheerio'

/**
 * Ashby no longer exposes careers.json for most companies.
 * The ONLY stable source is the HTML job listings on:
 *
 *   https://jobs.ashbyhq.com/<company>
 *
 * Jobs are embedded in HTML:
 *   - <a data-job-id="xxxx" href="/company/job/xxxxx">...</a>
 *   - Embedded script[type="application/ld+json"]
 */

export async function scrapeAshby(atsUrl: string): Promise<AtsJob[]> {
  const clean = atsUrl.replace(/\/$/, '')
  const htmlUrl = clean

  let html = ''
  try {
    const res = await fetch(htmlUrl, {
      headers: { 'User-Agent': 'SixFigureJobs/1.0 (+job-board-scraper)' },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.warn(`[Ashby] Failed HTML fetch ${htmlUrl}: ${res.status}`)
      return []
    }

    html = await res.text()
  } catch (err: any) {
    console.warn(
      `[Ashby] Network error fetching ${htmlUrl}: ${err?.message || err}`,
    )
    return []
  }

  const $ = cheerio.load(html)
  const jobs: AtsJob[] = []

  // 1) Try structured data first (Ashby embeds LD+JSON)
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')

      if (Array.isArray(json) || json['@type'] === 'JobPosting') {
        const items = Array.isArray(json) ? json : [json]

        for (const p of items) {
          if (p['@type'] !== 'JobPosting') continue

          const externalId =
            p.identifier?.value ||
            p.identifier ||
            p.url?.split('/').pop() ||
            null

          const salary = p.baseSalary || {}
          let salaryMin = salary.minValue ?? salary.value?.minValue ?? null
          let salaryMax = salary.maxValue ?? salary.value?.maxValue ?? null
          const salaryCurrency = salary.currency || salary.value?.currency || null
          const salaryInterval = salary.unitText || salary.value?.unitText || null

          // CRITICAL FIX: Ashby ALWAYS provides salary in cents
          // Always divide by 100 to convert cents to dollars
          if (salaryMin != null) {
            salaryMin = Math.round(salaryMin / 100)
          }
          if (salaryMax != null) {
            salaryMax = Math.round(salaryMax / 100)
          }

          const postedAt = p.datePosted ? new Date(p.datePosted) : null
          const updatedAt = p.dateModified ? new Date(p.dateModified) : postedAt

          jobs.push({
            externalId: String(externalId || ''),
            title: p.title ?? 'Untitled',
            url: p.url ?? htmlUrl,
            locationText: p.jobLocation?.address?.addressLocality ?? p.jobLocation?.name ?? null,
            remote:
              p.jobLocation?.name?.toLowerCase().includes('remote') ||
              p.jobLocation?.address?.addressLocality?.toLowerCase().includes('remote')
                ? true
                : null,

            salaryMin: salaryMin != null ? Number(salaryMin) : null,
            salaryMax: salaryMax != null ? Number(salaryMax) : null,
            salaryCurrency,
            salaryInterval,

            employmentType: p.employmentType ?? null,

            roleSlug: null,
            baseRoleSlug: null,
            seniority: null,
            discipline: null,
            isManager: false,

            postedAt,
            updatedAt,
            raw: p,
          })
        }
      }
    } catch {
      // ignore bad JSON
    }
  })

  if (jobs.length > 0) {
    console.log(`[Ashby] Extracted ${jobs.length} jobs via LD+JSON (${atsUrl})`)
    return jobs
  }

  // 2) Fallback to HTML job cards
  const jobCards = $('a[data-job-id]')

  jobCards.each((_i, el) => {
    const elem = $(el)
    const jobId = elem.attr('data-job-id')
    const href = elem.attr('href')

    if (!jobId || !href) return

    const title = elem.find('[data-job-title]').text().trim() || elem.text().trim()
    const locationText =
      elem.find('[data-job-location]').text().trim() || null

    const compText =
      elem.find('[data-job-compensation]').text().trim() || null

    let salaryMin: number | null = null
    let salaryMax: number | null = null
    let salaryCurrency: string | null = null

    if (compText && compText.match(/\d/)) {
      const nums = compText.match(/\$?([\d,]+)/g) || []
      const cleanNums = nums.map(n => Number(n.replace(/[$,]/g, '')))
      if (cleanNums.length === 1) {
        salaryMin = salaryMax = cleanNums[0]
      } else if (cleanNums.length >= 2) {
        salaryMin = cleanNums[0]
        salaryMax = cleanNums[1]
      }
      salaryCurrency = 'USD'
    }

    const jobUrl =
      href.startsWith('http') ? href : `${clean}${href.startsWith('/') ? '' : '/'}${href}`

    const remote =
      locationText?.toLowerCase().includes('remote') ||
      locationText?.toLowerCase().includes('anywhere') ||
      null

    jobs.push({
      externalId: jobId,
      title,
      url: jobUrl,
      locationText,
      remote,

      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryInterval: salaryMin || salaryMax ? 'YEAR' : null,

      employmentType: null,

      roleSlug: null,
      baseRoleSlug: null,
      seniority: null,
      discipline: null,
      isManager: false,

      postedAt: null,
      updatedAt: null,
      raw: { title, locationText, compText },
    })
  })

  console.log(`[Ashby] Extracted ${jobs.length} jobs from HTML (${atsUrl})`)
  return jobs
}