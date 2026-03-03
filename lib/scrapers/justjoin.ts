// lib/scrapers/justjoin.ts
import { upsertBoardJob } from './_boardHelpers'
import { addBoardIngestResult, errorStats, type ScraperStats } from './scraperStats'

const BOARD = 'justjoin'
const OFFERS_API = 'https://justjoin.it/api/offers' // primary API
const OFFER_FALLBACKS = [
  'https://justjoin.it/api/offers/',
  'https://justjoin.it/api/offers?sort=date',
]

type JustJoinOffer = {
  id: string | number
  title: string
  company_name: string
  workplace_type?: 'remote' | 'office' | 'hybrid'
  street?: string | null
  city?: string | null
  country_code?: string | null
  marker_icon?: string | null
  employment_types?: Array<{
    salary?: {
      from?: number | null
      to?: number | null
      currency?: string | null
      type?: 'b2b' | 'perm' | string | null
      period?: 'month' | 'year' | string | null
    } | null
  }>
  slug?: string
  remote?: boolean
}

async function fetchOffers(): Promise<JustJoinOffer[]> {
  const urls = [OFFERS_API, ...OFFER_FALLBACKS]
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SixFigureJobsBot/1.0)',
          Accept: 'application/json',
          Referer: 'https://justjoin.it/',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      return await res.json()
    } catch (err) {
      console.warn(`[${BOARD}] Failed ${url}: ${(err as any)?.message || err}`)
    }
  }
  console.warn(`[${BOARD}] No working offers endpoint; skipping scrape for now.`)
  return []
}

export async function scrapeJustJoin() {
  console.log('[JustJoin] Starting scrape...')

  try {
    const offers = await fetchOffers()
    console.log(`  Got ${offers.length} offers from API`)

    const stats: ScraperStats = { created: 0, updated: 0, skipped: 0 }

    for (const offer of offers) {
      try {
        const id = String(offer.id)
        const company = offer.company_name || 'Unknown company'
        const title = offer.title || 'Untitled role'

        const city = offer.city || ''
        const country = offer.country_code || ''
        const location = city && country ? `${city}, ${country}` : city || country || null

        // Salary: take first employment_type with salary
        let salaryText: string | null = null
        const salary = offer.employment_types?.find((et) => et.salary)?.salary || null
        if ((salary?.from || salary?.to) && salary.currency) {
          const cur = salary.currency
          const from = salary.from ?? null
          const to = salary.to ?? null
          const period = salary.period || 'month'
          if (from && to) {
            salaryText = `${cur} ${from.toLocaleString()}–${to.toLocaleString()} / ${period}`
          } else if (from) {
            salaryText = `${cur} ${from.toLocaleString()}+ / ${period}`
          } else if (to) {
            salaryText = `up to ${cur} ${to.toLocaleString()} / ${period}`
          }
        }

        const offerSlug = offer.slug || id
        const applyUrl = `https://justjoin.it/offers/${offerSlug}`

        const result = await upsertBoardJob({
          board: BOARD,
          externalId: id,
          title,
          company,
          applyUrl,
          location,
          salaryText,
          remote: offer.workplace_type === 'remote' || offer.remote === true,
        })
        addBoardIngestResult(stats, result)
      } catch (err) {
        console.error('    ❌ Error on JustJoin offer', offer, err)
        stats.skipped++
      }
    }

    console.log(`[JustJoin] ✓ Scraped ${stats.created} jobs`)
    return stats
  } catch (error) {
    console.error('[JustJoin] ❌ Scrape failed:', error)
    return errorStats(error)
  }
}
