// lib/scrapers/fourdayweek.ts
import * as cheerio from 'cheerio'
import { upsertBoardJob } from './_boardHelpers'

const BOARD = '4dayweek'
const BASE_URL = 'https://4dayweek.io'
const LIST_URL = `${BASE_URL}/remote-jobs`

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Remote100kBot/1.0)',
    },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }
  return res.text()
}

function absolute(url: string) {
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

export async function scrapeFourDayWeek() {
  console.log(`▶ Scraping ${BOARD}…`)

  const html = await fetchHtml(LIST_URL)
  const $ = cheerio.load(html)

  // Job cards are <article> blocks inside main listing (tune selector if needed)
  let cards = $('article, .job-card, .job').toArray()
  // Fallback: parse any JobPosting JSON-LD blocks
  if (cards.length === 0) {
    $('script[type="application/ld+json"]').each((_i, node) => {
      try {
        const raw = $(node).contents().text()
        const parsed = JSON.parse(raw)
        const items = Array.isArray(parsed)
          ? parsed
          : parsed && parsed['@type'] === 'JobPosting'
          ? [parsed]
          : parsed?.['@graph']
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            if (item['@type'] !== 'JobPosting') return
            const synthetic = $('<div class="job">')
            synthetic.append(`<a href="${item.url || item.identifier?.value || '#'}"></a>`)
            synthetic.append(`<h3>${item.title || ''}</h3>`)
            synthetic.append(`<h4>${item.hiringOrganization?.name || ''}</h4>`)
            synthetic.append(`<span>${item.jobLocation?.address?.addressLocality || item.jobLocationType || ''}</span>`)
            synthetic.append(`<span>${item.baseSalary?.value?.value || ''}</span>`)
            cards = [...cards, synthetic.get(0)]
          })
        }
      } catch {
        /* ignore JSON parse errors */
      }
    })
  }
  console.log(`  Found ${cards.length} potential job cards`)

  let created = 0
  const seen = new Set<string>()

  for (const el of cards) {
    const card = $(el)
    const linkEl = card.find('a[href^="/jobs/"]').first()
    const href = linkEl.attr('href')
    if (!href) continue

    const normalizedHref = href.split('#')[0]
    if (seen.has(normalizedHref)) continue
    seen.add(normalizedHref)

    const title =
      card.find('h3').first().text().trim() ||
      linkEl.text().trim()
    if (!title) continue

    const company =
      card.find('h4, h5').first().text().trim() ||
      'Unknown company'

    let location: string | null = null
    let salaryText: string | null = null

    card
      .find('li, span, p, small')
      .each((_i, node) => {
        const t = $(node).text().trim()
        if (!t) return
        if (!salaryText && /[$€£].*(year|yr|month|mo|day|hour)/i.test(t)) {
          salaryText = t
        }
        if (
          !location &&
          /remote|anywhere|usa|uk|europe|canada|australia|new zealand/i.test(
            t,
          )
        ) {
          location = t
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
    console.warn(`⚠️  ${BOARD}: no jobs ingested (selectors/JSON-LD may need refresh)`)
  } else {
    console.log(`✅ ${BOARD}: upserted ${created} jobs`)
  }
}
