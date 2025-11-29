// scripts/backfill-company-logos.ts
// Run: npx tsx scripts/backfill-company-logos.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Extract domain from website URL
 */
function extractDomain(website: string | null): string | null {
  if (!website) return null
  try {
    const url = new URL(website)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Generate Clearbit logo URL from domain
 * Clearbit provides free company logos at logo.clearbit.com
 */
function getClearbitLogoUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}`
}

/**
 * Try to guess domain from company name
 */
function guessCompanyDomain(name: string): string | null {
  // Common patterns
  const cleaned = name
    .toLowerCase()
    .replace(/\s+inc\.?$/i, '')
    .replace(/\s+corp\.?$/i, '')
    .replace(/\s+llc\.?$/i, '')
    .replace(/\s+ltd\.?$/i, '')
    .replace(/[^a-z0-9]/g, '')
  
  if (cleaned.length < 2) return null
  
  return `${cleaned}.com`
}

async function main() {
  // Find companies without logos
  const companiesWithoutLogos = await prisma.company.findMany({
    where: {
      logoUrl: null
    },
    select: {
      id: true,
      name: true,
      website: true,
      slug: true,
    }
  })

  console.log(`Found ${companiesWithoutLogos.length} companies without logos\n`)

  let updated = 0
  let skipped = 0

  for (const company of companiesWithoutLogos) {
    // Try to get domain from website first
    let domain = extractDomain(company.website)
    
    // If no website, try to guess from name
    if (!domain && company.name) {
      domain = guessCompanyDomain(company.name)
    }

    if (!domain) {
      console.log(`⏭ Skipped: ${company.name} (no domain found)`)
      skipped++
      continue
    }

    const logoUrl = getClearbitLogoUrl(domain)

    await prisma.company.update({
      where: { id: company.id },
      data: { logoUrl }
    })

    console.log(`✅ ${company.name} → ${logoUrl}`)
    updated++
  }

  console.log(`\n--- Summary ---`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Total: ${companiesWithoutLogos.length}`)

  // Also update companies that have broken/old logo URLs
  const companiesWithOldLogos = await prisma.company.findMany({
    where: {
      logoUrl: { not: null },
      NOT: {
        logoUrl: { startsWith: 'https://logo.clearbit.com/' }
      }
    },
    select: { id: true, name: true, website: true, logoUrl: true }
  })

  console.log(`\nFound ${companiesWithOldLogos.length} companies with non-Clearbit logos`)
  console.log(`(Keeping existing logos - they may be higher quality)`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())