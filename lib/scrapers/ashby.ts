// lib/scrapers/ats/ashby.ts
// Minimal HTML-based Ashby scraper.
// We do NOT rely on careers.json anymore because many boards return HTML there.

import * as cheerio from 'cheerio'

export async function scrapeAshby(atsSlugOrUrl: string): Promise<any[]> {
  // Normalize the input into a base URL like "https://jobs.ashbyhq.com/airbyte"
  const baseUrl = normalizeAshbyUrl(atsSlugOrUrl)

  const candidates = [
    baseUrl,
    `${baseUrl}/jobs`,
  ]

  let html: string | null = null
  let usedUrl: string | null = null

  // Try a couple of candidate URLs until one returns HTML
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Remote100k/1.0 (+ashby-scraper)',
          Accept: 'text/html,application/xhtml+xml',
        },
        cache: 'no-store',
      })
      if (!res.ok) {
        continue
      }

      const text = await res.text()
      if (!text || !text.includes('<html')) continue

      html = text
      usedUrl = url
      break
    } catch {
      // ignore and try next candidate
    }
  }

  if (!html || !usedUrl) {
    return []
  }

  const $ = cheerio.load(html)
  const jobs: any[] = []
  const seenUrls = new Set<string>()

  // Ashby job links usually live under /jobs/...
  $('a[href*="/jobs/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    const jobUrl = href.startsWith('http')
      ? href
      : new URL(href, usedUrl!).toString()

    if (seenUrls.has(jobUrl)) return
    seenUrls.add(jobUrl)

    const $link = $(el)
    const container = $link.closest(
      '[data-testid*="job"],[data-qa*="job"],article,li,div',
    )

    const title =
      $link.text().trim() ||
      container.find('h2,h3').first().text().trim()

    if (!title) return

    const locationText =
      container
        .find(
          '[data-testid*="location"],[data-qa="job-location"],[class*="location"]',
        )
        .first()
        .text()
        .trim() || null

    jobs.push({
      externalId: jobUrl,
      title,
      url: jobUrl,
      locationText,
      remote: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryInterval: null,
      employmentType: null,
      postedAt: null,
      updatedAt: null,
      raw: {
        url: jobUrl,
        locationText,
      },
    })
  })

  return jobs
}

function normalizeAshbyUrl(input: string): string {
  let url = input.trim()

  if (!url.startsWith('http')) {
    url = `https://jobs.ashbyhq.com/${url}`
  }

  // Strip any trailing slash
  url = url.replace(/\/$/, '')

  return url
}
