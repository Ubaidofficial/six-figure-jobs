// lib/scrapers/trawle.ts
import * as cheerio from 'cheerio'
import { upsertBoardJob } from './_boardHelpers'

const BOARD = 'trawle'
const BASE_URL = 'https://trawle.com'
const JOBS_URL = `${BASE_URL}/jobs`
const FALLBACK_URLS = [
  'https://trawle.com',
  'https://trawle.com/remote-jobs',
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

export async function scrapeTrawle(): Promise<void> {
  console.log(`▶ Scraping ${BOARD}…`)

  let html: string | null = null
  for (const url of [JOBS_URL, ...FALLBACK_URLS]) {
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

  // Initial guess at job cards
  let cards = $('.job-card, .job, article').toArray()

  if (cards.length === 0) {
    // Fallback: links under /jobs/
    $('a[href^="/jobs/"]').each((_i, el) => {
      cards = [...cards, el]
    })
  }

  if (cards.length === 0) {
    $('script[type="application/ld+json"]').each((_i, node) => {
      try {
        const raw = $(node).contents().text()
        const parsed = JSON.parse(raw)
        const items = Array.isArray(parsed) ? parsed : parsed?.['@graph']
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            if (item['@type'] !== 'JobPosting') return
            const synthetic = $('<div class="job">')
            synthetic.append(`<a href="${item.url || '#'}"></a>`)
            synthetic.append(`<h3>${item.title || ''}</h3>`)
            synthetic.append(`<h4>${item.hiringOrganization?.name || ''}</h4>`)
            synthetic.append(
              `<span>${item.jobLocation?.address?.addressLocality || item.jobLocationType || ''}</span>`,
            )
            synthetic.append(
              `<span>${item.baseSalary?.value?.value || ''}</span>`,
            )
            const elem = synthetic.get(0) as any
            if (elem && elem.type === 'tag') {
              cards = [...cards, elem]
            }
          })
        }
      } catch {
        /* ignore */
      }
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
        : card.find('a[href^="/jobs/"]').first()

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
      card.find('h4, .company, [data-role="company"]').first().text().trim() ||
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

  if (created === 0) {
    console.warn(`⚠️  ${BOARD}: no jobs ingested (site may have changed or is empty)`)
  } else {
    console.log(`✅ ${BOARD}: upserted ${created} jobs`)
  }
}

export default scrapeTrawle
