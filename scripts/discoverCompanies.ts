// scripts/discoverCompanies.ts
// Discovers companies from Y Combinator and other sources
// Works with CURRENT schema (no CompanySource model yet)

import { prisma } from '../lib/prisma'
import slugify from 'slugify'

interface DiscoveredCompany {
  name: string
  website?: string
  atsProvider?: string
  atsUrl?: string
  description?: string
  logoUrl?: string
  countryCode?: string
}

// ATS URL patterns for detection
const ATS_PATTERNS: Record<string, RegExp[]> = {
  greenhouse: [
    /boards\.greenhouse\.io\/([^\/\?]+)/i,
    /job-boards\.greenhouse\.io\/([^\/\?]+)/i,
    /boards-api\.greenhouse\.io\/.*boards\/([^\/\?]+)/i,
  ],
  lever: [
    /jobs\.lever\.co\/([^\/\?]+)/i,
  ],
  ashby: [
    /jobs\.ashbyhq\.com\/([^\/\?]+)/i,
  ],
  workday: [
    /([^\.]+)\.wd\d+\.myworkdayjobs\.com/i,
    /([^\.]+)\.myworkdayjobs\.com/i,
  ],
}

/**
 * Detect ATS provider from a URL
 */
export function detectAtsProvider(url: string): { provider: string; slug: string } | null {
  if (!url) return null

  for (const [provider, patterns] of Object.entries(ATS_PATTERNS)) {
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return { provider, slug: match[1] }
      }
    }
  }
  return null
}

/**
 * Map country string to country code
 */
function getCountryCode(country: string | null | undefined): string | null {
  if (!country) return null
  const lower = country.toLowerCase()
  
  if (lower.includes('united states') || lower === 'usa' || lower === 'us') return 'US'
  if (lower.includes('united kingdom') || lower === 'uk' || lower === 'gb') return 'GB'
  if (lower === 'canada') return 'CA'
  if (lower === 'germany') return 'DE'
  if (lower === 'france') return 'FR'
  if (lower === 'australia') return 'AU'
  if (lower === 'netherlands') return 'NL'
  if (lower === 'sweden') return 'SE'
  if (lower === 'india') return 'IN'
  if (lower === 'singapore') return 'SG'
  if (lower === 'ireland') return 'IE'
  if (lower === 'spain') return 'ES'
  if (lower === 'israel') return 'IL'
  
  return null
}

/**
 * Scrape Y Combinator companies from their public Algolia API
 */
export async function discoverYCombinatorCompanies(): Promise<DiscoveredCompany[]> {
  console.log('[YC] Fetching Y Combinator companies...')
  
  const companies: DiscoveredCompany[] = []
  const seenNames = new Set<string>()
  
  try {
    // YC public Algolia API - only companies that are hiring
    const apiKey = 'YzJlYjMxZTJkYWE4MDcwYmI5NjQ2ZjExNTZlZTY0ZjU2OTY4NjFlYTdhMTI3MmU5YzQ0ODIyYWIyMWI3NDA2N2ZpbHRlcnM9aXNIaXJpbmclM0R0cnVl'
    const appId = '45BWZJ1SGC'
    
    // Fetch multiple pages
    for (let page = 0; page < 10; page++) {
      console.log(`[YC] Fetching page ${page + 1}...`)
      
      const response = await fetch('https://45bwzj1sgc-dsn.algolia.net/1/indexes/*/queries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-algolia-api-key': apiKey,
          'x-algolia-application-id': appId,
        },
        body: JSON.stringify({
          requests: [{
            indexName: 'YCCompany_production',
            params: `hitsPerPage=1000&page=${page}`,
          }],
        }),
      })

      if (!response.ok) {
        console.error(`[YC] API error on page ${page}: ${response.status}`)
        break
      }

      const data = await response.json()
      const hits = data.results?.[0]?.hits || []
      
      if (hits.length === 0) {
        console.log(`[YC] No more results after page ${page}`)
        break
      }

      console.log(`[YC] Page ${page + 1}: ${hits.length} companies`)

      for (const hit of hits) {
        // Skip duplicates
        if (seenNames.has(hit.name)) continue
        seenNames.add(hit.name)

        // Try to find careers/jobs URL
        const atsUrl = hit.jobs_url || hit.ycdc_jobs_url || null
        let atsProvider: string | undefined
        
        // Detect ATS from jobs URL
        if (atsUrl) {
          const detected = detectAtsProvider(atsUrl)
          if (detected) {
            atsProvider = detected.provider
          }
        }

        companies.push({
          name: hit.name,
          website: hit.website || null,
          atsProvider,
          atsUrl,
          description: hit.one_liner?.slice(0, 500) || null,
          logoUrl: hit.small_logo_url || null,
          countryCode: getCountryCode(hit.country) || undefined,
        })
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 300))
    }

  } catch (err) {
    console.error('[YC] Error fetching companies:', err)
  }

  console.log(`[YC] Total unique companies discovered: ${companies.length}`)
  return companies
}

/**
 * Import discovered companies into the database
 * Uses ONLY fields that exist in current schema
 */
export async function importCompanies(companies: DiscoveredCompany[]): Promise<{
  created: number
  updated: number
  skipped: number
}> {
  let created = 0
  let updated = 0
  let skipped = 0

  for (const company of companies) {
    try {
      const slug = slugify(company.name, { lower: true, strict: true })
      
      if (!slug || slug.length < 2) {
        skipped++
        continue
      }

      const existing = await prisma.company.findUnique({
        where: { slug },
      })

      if (existing) {
        // Update if we have new ATS info that's missing
        if (company.atsUrl && company.atsProvider && !existing.atsUrl) {
          await prisma.company.update({
            where: { slug },
            data: {
              atsUrl: company.atsUrl,
              atsProvider: company.atsProvider,
              logoUrl: company.logoUrl || existing.logoUrl,
              description: company.description || existing.description,
              countryCode: company.countryCode || existing.countryCode,
            },
          })
          updated++
        } else {
          skipped++
        }
      } else {
        await prisma.company.create({
          data: {
            name: company.name,
            slug,
            website: company.website || null,
            atsProvider: company.atsProvider || null,
            atsUrl: company.atsUrl || null,
            description: company.description || null,
            logoUrl: company.logoUrl || null,
            countryCode: company.countryCode || null,
          },
        })
        created++
      }

    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Duplicate slug - skip
        skipped++
      } else {
        console.error(`[Import] Error with ${company.name}:`, err?.message)
        skipped++
      }
    }
  }

  return { created, updated, skipped }
}

/**
 * Main discovery function
 */
export async function runCompanyDiscovery() {
  console.log('===========================================')
  console.log('       COMPANY DISCOVERY PIPELINE')
  console.log('===========================================\n')

  const startTime = Date.now()

  // 1. Y Combinator companies
  console.log('--- Source: Y Combinator ---')
  const ycCompanies = await discoverYCombinatorCompanies()
  
  // Filter to only companies with ATS URLs (these are the ones we can scrape)
  const companiesWithAts = ycCompanies.filter(c => c.atsUrl && c.atsProvider)
  console.log(`[YC] Companies with detectable ATS: ${companiesWithAts.length}`)
  
  // Import all companies (even without ATS, they're still useful)
  const ycResults = await importCompanies(ycCompanies)
  console.log(`[YC] Created: ${ycResults.created}, Updated: ${ycResults.updated}, Skipped: ${ycResults.skipped}`)
  console.log('')

  // Final stats
  const totalCompanies = await prisma.company.count()
  const withAts = await prisma.company.count({ 
    where: { 
      atsProvider: { not: null },
      atsUrl: { not: null },
    } 
  })

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('===========================================')
  console.log('           DISCOVERY COMPLETE')
  console.log('===========================================')
  console.log(`Total Companies in DB: ${totalCompanies}`)
  console.log(`Companies with ATS:    ${withAts}`)
  console.log(`Duration:              ${duration}s`)
  console.log('===========================================')
}

// Run if executed directly
if (require.main === module) {
  runCompanyDiscovery()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Discovery failed:', err)
      process.exit(1)
    })
}