// lib/scrapers/builtin.js
// BuiltIn → Company discovery only

import * as cheerio from 'cheerio'
import { prisma } from '../prisma'
import { detectAtsFromUrl } from '../normalizers/ats'

const BOARD_NAME = 'builtin'
const URL = 'https://builtin.com/jobs/remote'

// ---------------------- Utils ---------------------- //

function slugifyCompany(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Extract company information from a BuiltIn job card.
 */
function extractCompanyFromBuiltInJob($, el) {
  const $el = $(el)

  // -----------------------------------------
  // 1. PRIMARY NAME SOURCES
  // -----------------------------------------
  let name =
    $el.find('.company, [class*="company"], .company-title').first().text().trim() ||
    ''

  // -----------------------------------------
  // 2. FALLBACK: Scan text blocks for potential company names
  // (avoid salary, job type, "Remote", etc.)
  // -----------------------------------------
  if (!name) {
    const parts = $el
      .text()
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)

    name =
      parts.find(
        (p) =>
          p.length > 1 &&
          !/^\$/.test(p) &&
          !/\b(Remote|Full|Part|Contract|USA|United States)\b/i.test(p) &&
          !/\d/.test(p)
      ) || ''
  }

  if (!name) return null

  const slug = slugifyCompany(name)

  // -----------------------------------------
  // Extract logo if available
  // -----------------------------------------
  let logoUrl = null
  const $img = $el.find('img').first()
  if ($img.length) {
    const src = $img.attr('src')
    if (src && !src.includes('placeholder')) {
      logoUrl = src.startsWith('http') ? src : `https://builtin.com${src}`
    }
  }

  // -----------------------------------------
  // BuiltIn rarely exposes a clean company website – but job posting links
  // often forward to ATS URLs → so we use that for ATS detection.
  // -----------------------------------------
  const jobHref = $el.find('a[href*="/job/"]').first().attr('href')
  const jobUrl = jobHref
    ? jobHref.startsWith('http')
      ? jobHref
      : `https://builtin.com${jobHref}`
    : null

  const atsMeta = detectAtsFromUrl ? detectAtsFromUrl(jobUrl) : null

  return {
    name,
    slug,
    logoUrl,
    website: null,
    atsProvider: atsMeta?.provider ?? null,
    atsUrl: atsMeta?.boardUrl ?? null,
  }
}

// ---------------------- Main Scraper ---------------------- //

export default async function scrapeBuiltIn() {
  console.log('[BuiltIn] Starting scrape...')

  let html
  try {
    const res = await fetch(URL, {
      headers: {
        'User-Agent': 'SixFigureJobs/1.0 (+job-board-scraper)',
        Accept: 'text/html',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(`[${BOARD_NAME}] HTTP ${res.status} for ${URL}`)
      return { created: 0, updated: 0, skipped: 0, error: `HTTP ${res.status}` }
    }

    html = await res.text()
  } catch (err) {
    console.error(`[${BOARD_NAME}] Network error:`, err)
    return { created: 0, updated: 0, skipped: 0, error: err instanceof Error ? err.message : String(err) }
  }

  const $ = cheerio.load(html)

  // BuiltIn scatters job links across listings → grab a wide set
  const jobEls = $(
    '.jobs-list-item, article, [data-id*="job"], a[href*="/job/"]'
  )

  console.log(`[${BOARD_NAME}] Found ~${jobEls.length} potential job snippets`)

  const companiesBySlug = new Map()

  jobEls.each((i, el) => {
    const company = extractCompanyFromBuiltInJob($, el)
    if (!company) return
    if (!companiesBySlug.has(company.slug)) {
      companiesBySlug.set(company.slug, company)
    }
  })

  const companies = Array.from(companiesBySlug.values())

  let companiesUpserted = 0

  for (const c of companies) {
    try {
      await prisma.company.upsert({
        where: { slug: c.slug },
        update: {
          name: c.name,
          logoUrl: c.logoUrl ?? undefined,
          website: c.website ?? undefined,
          atsProvider: c.atsProvider ?? undefined,
          atsUrl: c.atsUrl ?? undefined,
        },
        create: {
          name: c.name,
          slug: c.slug,
          logoUrl: c.logoUrl ?? undefined,
          website: c.website ?? undefined,
          atsProvider: c.atsProvider ?? undefined,
          atsUrl: c.atsUrl ?? undefined,
        },
      })
      companiesUpserted++
    } catch (err) {
      console.error(
        `[${BOARD_NAME}] Company upsert failed for ${c.name}`,
        err
      )
    }
  }

  console.log(
    `[${BOARD_NAME}] ${companiesUpserted} companies upserted from ~${companies.length} unique`
  )

  return {
    created: companiesUpserted,
    updated: 0,
    skipped: Math.max(0, companies.length - companiesUpserted),
  }
}
