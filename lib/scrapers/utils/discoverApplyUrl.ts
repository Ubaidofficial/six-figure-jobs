// lib/scrapers/utils/discoverApplyUrl.ts

import { extractApplyDestinationFromHtml } from './extractApplyLink'

export async function discoverApplyUrlFromPage(jobUrl: string): Promise<string | null> {
  try {
    const res = await fetch(jobUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    })

    if (!res.ok) return null
    const html = await res.text()
    if (!html) return null

    return extractApplyDestinationFromHtml(html, jobUrl)
  } catch {
    return null
  }
}

