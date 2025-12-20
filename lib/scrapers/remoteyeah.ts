// lib/scrapers/remoteyeah.ts
// Scrapes companies from RemoteYeah.com/remote-companies
import axios from 'axios'
import * as cheerio from 'cheerio'
import { PrismaClient } from '@prisma/client'
import { safeSlug } from './base'

const prisma = new PrismaClient()

interface RemoteYeahCompany {
  name: string
  website: string
  careers?: string
}

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw)
    url.hash = ''
    // normalize trailing slash
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    return url.toString()
  } catch {
    return raw.trim()
  }
}

function isRemoteYeahUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.hostname.toLowerCase().includes('remoteyeah.com')
  } catch {
    return false
  }
}

async function ensureUniqueCompanySlug(base: string): Promise<string> {
  const normalizedBase = base.trim() ? safeSlug(base) : 'company'
  let attempt = normalizedBase
  for (let i = 0; i < 25; i++) {
    const exists = await prisma.company.findUnique({ where: { slug: attempt }, select: { id: true } })
    if (!exists) return attempt
    attempt = `${normalizedBase}-${i + 2}`
  }
  return `${normalizedBase}-${Date.now()}`
}

export async function scrapeRemoteYeahCompanies(): Promise<RemoteYeahCompany[]> {
  console.log('[RemoteYeah] Scraping companies...')

  try {
    const response = await axios.get('https://remoteyeah.com/remote-companies', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 30000,
    })

    const $ = cheerio.load(response.data)
    const companies: RemoteYeahCompany[] = []

    // Adapt selectors based on RemoteYeah's HTML structure
    $('.company-card, .company-item, [data-company]').each((_, el) => {
      const $el = $(el)
      const name = $el.find('.company-name, h3, h2').first().text().trim()
      const website = $el.find('a[href*="http"]').first().attr('href') || ''
      const careers = $el.find('a[href*="career"], a[href*="jobs"]').first().attr('href')

      if (!name || !website) return

      const normalizedWebsite = normalizeUrl(website)
      if (!normalizedWebsite || isRemoteYeahUrl(normalizedWebsite)) return

      const normalizedCareers = careers ? normalizeUrl(careers) : undefined
      companies.push({ name, website: normalizedWebsite, careers: normalizedCareers })
    })

    console.log(`[RemoteYeah] Found ${companies.length} companies`)
    return companies
  } catch (error) {
    console.error('[RemoteYeah] Scrape failed:', error)
    return []
  }
}

export default async function scrapeRemoteYeah() {
  console.log('[RemoteYeah] Starting scrape...')

  try {
    const companies = await scrapeRemoteYeahCompanies()
    let added = 0
    let skipped = 0

    for (const comp of companies) {
      const website = normalizeUrl(comp.website)

      // Check for duplicates
      const existing = await prisma.company.findFirst({
        where: {
          OR: [
            { name: { equals: comp.name, mode: 'insensitive' } },
            ...(website ? [{ website }] : []),
          ],
        },
        select: { id: true },
      })

      if (existing) {
        skipped++
        continue
      }

      const slug = await ensureUniqueCompanySlug(comp.name)

      // Create company
      const created = await prisma.company.create({
        data: {
          name: comp.name,
          website,
          slug,
        },
        select: { id: true },
      })

      // Create generic source if careers page exists
      if (comp.careers) {
        const careersUrl = normalizeUrl(comp.careers)
        if (careersUrl && !isRemoteYeahUrl(careersUrl)) {
          await prisma.companySource.create({
            data: {
              companyId: created.id,
              url: careersUrl,
              sourceType: 'generic_careers_page',
              isActive: true,
            },
          })
        }
      }

      added++
    }

    console.log(`[RemoteYeah] ✓ Added ${added} companies, skipped ${skipped}`)
    return { created: added, updated: 0, skipped }
  } catch (error) {
    console.error('[RemoteYeah] ❌ Scrape failed:', error)
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
