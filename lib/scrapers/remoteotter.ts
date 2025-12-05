// lib/scrapers/remoteotter.ts
import * as cheerio from 'cheerio'
import { upsertBoardJob } from './_boardHelpers'

const BOARD = 'remoteotter'
const BASE_URL = 'https://remoteotter.com'
const LIST_URL = `${BASE_URL}/remote-jobs`

const FALLBACK_URLS = [
  'https://remoteotter.com',
  'https://remoteotter.com/jobs',
]

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SixFigureJobsBot/1.0)',
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }

  return res.text()
}

function absolute(url: string): string {
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

export async function scrapeRemoteOtter(): Promise<void> {
  console.log(`▶ Scraping ${BOARD}…`)

  let html: string | null = null
  for (const url of [LIST_URL, ...FALLBACK_URLS]) {
    try {
      html = await fetchHtml(url)
      break
    } catch (err) {
      console.warn(`[${BOARD}] Failed ${url}: ${(err as any)?.message ?? err}`)
    }
  }

  if (!html) {
    console.warn(`[${BOARD}] No HTML fetched, skipping`)
    return
  }

  const $ = cheerio.load(html)

  // Try to grab all obvious job cards
  const cards = $('.job-card, .job, [data-role="job-card"]').toArray()

  if (cards.length === 0) {
    // Fallback: any link containing /jobs/
    $('a[href*="/jobs/"]').each((_i, el) => {
      cards.push(el)
    })
  }

  console.log(`  Found ${cards.length} potential job cards`)

  let created = 0
  const seen = new Set<string>()

  for (const el of cards) {
    const card = $(el)

    const linkEl =
      card.is('a') && card.attr('href')
        ? card
        : card.find('a[href*="/jobs/"]').first()

    const href = linkEl.attr('href')
    if (!href) continue

    const normalizedHref = href.split('#')[0]
    if (seen.has(normalizedHref)) continue
    seen.add(normalizedHref)

    const title =
      card.find('h2, h3, [data-role="job-title"]').first().text().trim() ||
      linkEl.text().trim()
    if (!title) continue

    const company =
      card.find('[data-role="company"], .company').first().text().trim() ||
      'Unknown company'

    let location: string | null = null
    let salaryText: string | null = null

    card.find('span, p, li, small').each((_i, node) => {
      const t = $(node).text().trim()
      if (!t) return

      if (!location && /remote|anywhere|usa|uk|europe|canada/i.test(t)) {
        location = t
      }

      if (!salaryText && /[$€£]|k\/yr|year|month|salary/i.test(t)) {
        salaryText = t
      }
    })

    const applyUrl = absolute(normalizedHref)

    await upsertBoardJob({
      board: BOARD,
      externalId: normalizedHref.replace(/^\//, ''),
      title,
      company,
      applyUrl,
      location,
      salaryText,
      remote: /remote/i.test(location || ''),
    })

    created++
  }

  console.log(`✅ ${BOARD}: upserted ${created} jobs`)
}

export default scrapeRemoteOtter
