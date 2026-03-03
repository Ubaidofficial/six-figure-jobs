import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

const prisma = new PrismaClient()

// Simple description fetcher - tries to get meta description from company website
async function fetchDescription(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return null
    
    const html = await res.text()
    
    // Try meta description
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
    
    if (metaMatch && metaMatch[1]) {
      return metaMatch[1].trim().slice(0, 500)
    }
    
    // Try og:description
    const ogMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    if (ogMatch && ogMatch[1]) {
      return ogMatch[1].trim().slice(0, 500)
    }
    
    return null
  } catch (e) {
    return null
  }
}

async function main() {
  // Get companies without descriptions that have websites
  const companies = await prisma.company.findMany({
    where: {
      description: null,
      website: { not: null }
    },
    select: { id: true, name: true, website: true },
    take: 50 // Process 50 at a time
  })
  
  __slog('Fetching descriptions for', companies.length, 'companies...\n')
  
  let updated = 0
  
  for (const company of companies) {
    if (!company.website) continue
    
    process.stdout.write('  ' + company.name + '... ')
    
    const desc = await fetchDescription(company.website)
    
    if (desc && desc.length > 20) {
      await prisma.company.update({
        where: { id: company.id },
        data: { description: desc }
      })
      __slog('OK (' + desc.length + ' chars)')
      updated++
    } else {
      __slog('skipped')
    }
  }
  
  __slog('\nUpdated', updated, 'companies with descriptions')
  await prisma.$disconnect()
}

main()
