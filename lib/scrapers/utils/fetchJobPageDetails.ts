// Fetches a board job page once and returns both the external apply URL and description HTML.
import * as cheerio from 'cheerio'
import { extractApplyDestinationFromHtml } from './extractApplyLink'

const DESCRIPTION_SELECTORS = [
  '.job-description', '.job-content', '.description', '#job-description',
  '[data-testid="job-description"]', '.content-body', '.job-body',
  'article .content', '.post-content', 'main article', 'article', 'main',
]

export async function fetchJobPageDetails(
  jobUrl: string,
  boardHost: string,
): Promise<{ applyUrl: string | null; descriptionHtml: string | null }> {
  try {
    const res = await fetch(jobUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    })
    if (!res.ok) return { applyUrl: null, descriptionHtml: null }
    const html = await res.text()

    const applyUrl = extractApplyDestinationFromHtml(html, jobUrl) ?? null
    const filteredApply =
      applyUrl && !applyUrl.includes(boardHost) ? applyUrl : null

    const $ = cheerio.load(html)
    let descriptionHtml: string | null = null
    let bestLen = 0
    for (const sel of DESCRIPTION_SELECTORS) {
      const $el = $(sel).first()
      if (!$el.length) continue
      const len = $el.text().replace(/\s+/g, ' ').trim().length
      if (len >= 200 && len <= 80_000 && len > bestLen) {
        bestLen = len
        descriptionHtml = $el.html() || null
      }
    }

    return { applyUrl: filteredApply, descriptionHtml }
  } catch {
    return { applyUrl: null, descriptionHtml: null }
  }
}
