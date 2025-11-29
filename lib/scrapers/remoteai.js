// lib/scrapers/remoteai.js
// RemoteAI.io → Company discovery ONLY (no ATS logic)

import * as cheerio from 'cheerio'
import { prisma } from '../prisma'

const BOARD_NAME = 'remoteai'
const BASE_URL = 'https://remoteai.io'

// ---------------------- utils ---------------------- //

function slugifyCompany(name) {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Extract company info from a RemoteAI job card.
 * Only returns clean company metadata — NEVER job data.
 */
function extractCompanyFromRemoteAiJob($, linkElement) {
  const $link = $(linkElement)
  const href = $link.attr('href')
  if (!href || !href.includes('/jobs/')) return null

  const $card =
    $link.closest('article, .job-card, .job, li, div').first() || $link.parent()

  // 1) Company name heuristics
  let company = null

  // Try logo alt text
  const $img = $card.find('img[alt]').first()
  if ($img.length) {
    const alt = $img.attr('alt')
    if (alt && alt.length < 100) company = alt.trim()
  }

  // Try fallback visible text near the title
  if (!company) {
    const fallback = $card
      .find('.company, .company-name, .text-sm')
      .first()
      .text()
      .trim()
    if (fallback) company = fallback
  }

  if (!company) return null

  const slug = slugifyCompany(company)

  // 2) Logo extraction
  let logoUrl = null
  if ($img.length) {
    const src = $img.attr('src')
    if (src && !src.includes('placeholder')) {
      logoUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`
    }
  }

  return {
    name: company,
    slug,
    logoUrl,
    website: null, // RemoteAI does not expose company website
  }
}

// ---------------------- main scraper ---------------------- //

export default async function scrapeRemoteAI() {
  console.log(`Scraping RemoteAI.io (companies only)…`)

  let html
  try {
    const res = await fetch(BASE_URL, {
      headers: {
        'User-Agent': 'Remote100k/1.0 (+job-board-scraper)',
        Accept: 'text/html',
      },
      cache: 'no-store',
    })
    html = await res.text()
  } catch (err) {
    console.error(`[${BOARD_NAME}] Fetch error`, err)
    return { companiesUpserted: 0, error: 'network-error' }
  }

  const $ = cheerio.load(html)
  const companiesBySlug = new Map()

  // RemoteAI job links
  $('a[href*="/jobs/"]').each((_, el) => {
    const company = extractCompanyFromRemoteAiJob($, el)
    if (company && !companiesBySlug.has(company.slug)) {
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
        },
        create: {
          name: c.name,
          slug: c.slug,
          logoUrl: c.logoUrl ?? undefined,
          website: c.website ?? undefined,
        },
      })
      companiesUpserted++
    } catch (err) {
      console.error(`[${BOARD_NAME}] Company upsert failed: ${c.slug}`, err)
    }
  }

  console.log(`[${BOARD_NAME}] ${companiesUpserted} companies upserted`)
  return { companiesUpserted }
}
