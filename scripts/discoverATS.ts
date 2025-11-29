import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Common careers page paths to check
const CAREERS_PATHS = ['/careers', '/jobs', '/careers/', '/jobs/', '/about/careers', '/company/careers']

// ATS patterns to detect
const ATS_PATTERNS = [
  { name: 'greenhouse', pattern: /boards\.greenhouse\.io\/(\w+)/i, urlTemplate: 'https://boards.greenhouse.io/$1' },
  { name: 'greenhouse', pattern: /greenhouse\.io\/(?:embed\/)?job_board\?.*for=(\w+)/i, urlTemplate: 'https://boards.greenhouse.io/$1' },
  { name: 'lever', pattern: /jobs\.lever\.co\/(\w+)/i, urlTemplate: 'https://jobs.lever.co/$1' },
  { name: 'ashby', pattern: /jobs\.ashbyhq\.com\/(\w+)/i, urlTemplate: 'https://jobs.ashbyhq.com/$1' },
  { name: 'ashby', pattern: /api\.ashbyhq\.com\/posting-api\/job-board\/(\w+)/i, urlTemplate: 'https://jobs.ashbyhq.com/$1' },
]

async function fetchWithTimeout(url: string, timeout = 10000): Promise<string | null> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Remote100kBot/1.0)' },
      signal: controller.signal,
      redirect: 'follow'
    })
    clearTimeout(id)
    if (!res.ok) return null
    return await res.text()
  } catch {
    clearTimeout(id)
    return null
  }
}

async function detectATS(companyName: string, website: string): Promise<{ ats: string, url: string } | null> {
  const baseUrl = website.replace(/\/$/, '')
  
  // Check careers pages
  for (const path of CAREERS_PATHS) {
    const url = baseUrl + path
    const html = await fetchWithTimeout(url)
    if (!html) continue
    
    // Check for ATS patterns
    for (const { name, pattern, urlTemplate } of ATS_PATTERNS) {
      const match = html.match(pattern)
      if (match) {
        const atsUrl = urlTemplate.replace('$1', match[1])
        console.log(`  ✓ Found ${name}: ${atsUrl}`)
        return { ats: name, url: atsUrl }
      }
    }
  }
  
  // Also check homepage
  const html = await fetchWithTimeout(baseUrl)
  if (html) {
    for (const { name, pattern, urlTemplate } of ATS_PATTERNS) {
      const match = html.match(pattern)
      if (match) {
        const atsUrl = urlTemplate.replace('$1', match[1])
        console.log(`  ✓ Found ${name} on homepage: ${atsUrl}`)
        return { ats: name, url: atsUrl }
      }
    }
  }
  
  return null
}

async function main() {
  // Get companies with website but no ATS URL
  const companies = await prisma.company.findMany({
    where: {
      website: { not: null },
      atsUrl: null,
      name: { not: 'Add Your Company' } // Skip placeholder
    },
    take: 100 // Process in batches
  })
  
  console.log(`\n🔍 Scanning ${companies.length} companies for ATS...\n`)
  
  let found = 0
  let notFound = 0
  
  for (const company of companies) {
    if (!company.website) continue
    
    process.stdout.write(`${company.name}...`)
    
    const result = await detectATS(company.name, company.website)
    
    if (result) {
      await prisma.company.update({
        where: { id: company.id },
        data: { atsUrl: result.url }
      })
      found++
    } else {
      console.log(' ✗ No ATS found')
      notFound++
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 500))
  }
  
  console.log(`\n═══════════════════════════════════`)
  console.log(`  ✅ Found ATS: ${found}`)
  console.log(`  ❌ No ATS: ${notFound}`)
  console.log(`═══════════════════════════════════\n`)
  
  // Show updated count
  const totalWithAts = await prisma.company.count({ where: { atsUrl: { not: null } } })
  console.log(`Total companies with ATS URLs: ${totalWithAts}`)
  
  await prisma.$disconnect()
}

main().catch(console.error)
