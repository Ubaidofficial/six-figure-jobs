import { PrismaClient } from '@prisma/client'

// Use pooled URL with a longer pool timeout to avoid P2024 timeouts
const baseUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  ''
const dbUrl = baseUrl.includes('?')
  ? `${baseUrl}&pool_timeout=30`
  : `${baseUrl}?pool_timeout=30`

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
})

// Common careers page paths to check
const CAREERS_PATHS = [
  '/careers',
  '/jobs',
  '/join-us',
  '/careers/',
  '/jobs/',
  '/about/careers',
  '/company/careers',
]

// ATS patterns to detect (expanded)
const ATS_PATTERNS = [
  { name: 'greenhouse', pattern: /boards\.greenhouse\.io\/([\w-]+)/i, urlTemplate: 'https://boards.greenhouse.io/$1' },
  { name: 'greenhouse', pattern: /greenhouse\.io\/(?:embed\/)?job_board\?.*for=([\w-]+)/i, urlTemplate: 'https://boards.greenhouse.io/$1' },
  { name: 'lever', pattern: /jobs\.lever\.co\/([\w-]+)/i, urlTemplate: 'https://jobs.lever.co/$1' },
  { name: 'ashby', pattern: /jobs\.ashbyhq\.com\/([\w-]+)/i, urlTemplate: 'https://jobs.ashbyhq.com/$1' },
  { name: 'ashby', pattern: /api\.ashbyhq\.com\/posting-api\/job-board\/([\w-]+)/i, urlTemplate: 'https://jobs.ashbyhq.com/$1' },
  { name: 'workday', pattern: /https?:\/\/([^\.]+)\.wd\d+\.myworkdayjobs\.com\/[^"']+/i, urlTemplate: 'https://$1.wd5.myworkdayjobs.com' },
  { name: 'workday', pattern: /https?:\/\/([^\.]+)\.myworkdayjobs\.com\/[^"']+/i, urlTemplate: 'https://$1.myworkdayjobs.com' },
  { name: 'smartrecruiters', pattern: /careers\.smartrecruiters\.com\/([^\/\s"']+)/i, urlTemplate: 'https://careers.smartrecruiters.com/$1' },
  { name: 'teamtailor', pattern: /jobs\.teamtailor\.com\/companies\/([^\/\s"']+)/i, urlTemplate: 'https://jobs.teamtailor.com/companies/$1' },
  { name: 'breezy', pattern: /breezy\.hr\/companies\/([^\/\s"']+)/i, urlTemplate: 'https://breezy.hr/companies/$1' },
  { name: 'recruitee', pattern: /([\w-]+)\.recruitee\.com/i, urlTemplate: 'https://$1.recruitee.com' },
  { name: 'workable', pattern: /apply\.workable\.com\/([^\/\s"']+)/i, urlTemplate: 'https://apply.workable.com/$1' },
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
  const batch = 500
  let skip = 0
  let found = 0
  let notFound = 0
  let processed = 0

  while (true) {
    const companies = await prisma.company.findMany({
      where: {
        website: { not: null },
        atsUrl: null,
        name: { not: 'Add Your Company' }, // Skip placeholder
      },
      take: batch,
      skip,
    })

    if (companies.length === 0) break

    console.log(`\n🔍 Scanning ${companies.length} companies (skip=${skip})...\n`)

    for (const company of companies) {
      processed++
      if (!company.website) continue

      process.stdout.write(`${company.name}...`)

      const result = await detectATS(company.name, company.website)

      if (result) {
        await prisma.company.update({
          where: { id: company.id },
          data: { atsUrl: result.url, atsProvider: result.ats },
        })
        console.log(` ✓ ${result.ats}`)
        found++
      } else {
        console.log(' ✗ No ATS found')
        notFound++
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 300))
    }

    skip += companies.length
    if (companies.length < batch) break
  }

  console.log(`\n═══════════════════════════════════`)
  console.log(`  ✅ Found ATS: ${found}`)
  console.log(`  ❌ No ATS: ${notFound}`)
  console.log(`  Processed: ${processed}`)
  console.log(`═══════════════════════════════════\n`)

  // Show updated count
  const totalWithAts = await prisma.company.count({ where: { atsUrl: { not: null } } })
  console.log(`Total companies with ATS URLs: ${totalWithAts}`)

  await prisma.$disconnect()
}

main().catch(console.error)
