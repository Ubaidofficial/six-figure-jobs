// scripts/enrichAtsMetadata.ts
// Phase 3 – Enrich companies with atsProvider + atsUrl (self-contained)

import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'

const prisma = new PrismaClient()

// -----------------------------------------------------
// Minimal ATS detector (copied from lib/normalizers/ats.ts)
// -----------------------------------------------------
type AtsProvider =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'smartrecruiters'
  | 'recruitee'
  | 'personio'
  | 'teamtailor'

interface DetectedAts {
  provider: AtsProvider
  atsUrl: string
}

function detectAtsFromUrl(rawUrl: string | null | undefined): DetectedAts | null {
  if (!rawUrl) return null

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  const path = url.pathname.replace(/\/+$/, '')

  // Greenhouse: https://boards.greenhouse.io/figma/jobs/123
  if (host === 'boards.greenhouse.io') {
    const parts = path.split('/').filter(Boolean)
    const boardSlug = parts[0]
    if (!boardSlug) return null
    return {
      provider: 'greenhouse',
      atsUrl: `https://boards.greenhouse.io/${boardSlug}`,
    }
  }

  // Lever: https://jobs.lever.co/figma/abc
  if (host === 'jobs.lever.co') {
    const parts = path.split('/').filter(Boolean)
    const companySlug = parts[0]
    if (!companySlug) return null
    return {
      provider: 'lever',
      atsUrl: `https://jobs.lever.co/${companySlug}`,
    }
  }

  // Ashby: https://jobs.ashbyhq.com/figma/role-id
  if (host === 'jobs.ashbyhq.com') {
    const parts = path.split('/').filter(Boolean)
    const companySlug = parts[0]
    if (!companySlug) return null
    return {
      provider: 'ashby',
      atsUrl: `https://jobs.ashbyhq.com/${companySlug}`,
    }
  }

  // Workday: *.myworkdayjobs.com / workdayjobs.com
  if (host.includes('myworkdayjobs.com') || host.includes('workdayjobs.com')) {
    const basePath = path.split('/job')[0] || ''
    return {
      provider: 'workday',
      atsUrl: `${url.origin}${basePath}`,
    }
  }

  // SmartRecruiters: https://careers.smartrecruiters.com/Figma/Role
  if (host === 'careers.smartrecruiters.com') {
    const parts = path.split('/').filter(Boolean)
    const companySlug = parts[0]
    if (!companySlug) return null
    return {
      provider: 'smartrecruiters',
      atsUrl: `https://careers.smartrecruiters.com/${companySlug}`,
    }
  }

  // Recruitee: https://figma.recruitee.com/o/some-role
  if (host.endsWith('.recruitee.com')) {
    return {
      provider: 'recruitee',
      atsUrl: `https://${host}`,
    }
  }

  // Personio: https://acme.jobs.personio.com/job/123
  if (host.endsWith('.personio.de') || host.endsWith('.jobs.personio.com')) {
    return {
      provider: 'personio',
      atsUrl: `${url.origin}`,
    }
  }

  // Teamtailor: https://careers.acme.com / careers.acme.teamtailor.com
  if (host.includes('teamtailor.com')) {
    return {
      provider: 'teamtailor',
      atsUrl: `${url.origin}`,
    }
  }

  return null
}

// -----------------------------------------------------
// Fetch helper with timeout
// -----------------------------------------------------
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SixFigureJobsBot/1.0 (+https://www.6figjobs.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(id)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

// -----------------------------------------------------
// Scan a page for ATS links
// -----------------------------------------------------
async function findAtsLinkInHtml(
  html: string,
  baseUrl: string
): Promise<{ provider: string; atsUrl: string } | null> {
  const $ = cheerio.load(html)
  let found: { provider: string; atsUrl: string } | null = null

  $('a[href]').each((_, el) => {
    if (found) return false
    const href = $(el).attr('href')
    if (!href) return

    let full: string
    try {
      full = new URL(href, baseUrl).toString()
    } catch {
      return
    }

    const detected = detectAtsFromUrl(full)
    if (detected) {
      found = detected
      return false
    }
  })

  if (found) return found

  const bodyText = $('body').text().toLowerCase()

  const checkIframe = (substr: string): DetectedAts | null => {
    const iframeSrc = $(`iframe[src*="${substr}"]`).attr('src')
    if (!iframeSrc) return null
    const full = new URL(iframeSrc, baseUrl).toString()
    return detectAtsFromUrl(full)
  }

  return (
    checkIframe('greenhouse') ||
    checkIframe('lever.co') ||
    checkIframe('ashbyhq.com') ||
    null
  )
}

// -----------------------------------------------------
// Main worker
// -----------------------------------------------------
async function main() {
  console.log('🔍 Starting ATS metadata enrichment...')

  const companies = await prisma.company.findMany({
    where: {
      website: { not: null },
      atsProvider: null,
      atsUrl: null,
    },
    take: 100,
  })

  console.log(`Found ${companies.length} companies to check.`)

  let updated = 0

  for (const company of companies) {
    if (!company.website) continue

    console.log(`→ Checking ${company.name} (${company.website})`)

    const html = await fetchHtml(company.website)
    let result = html
      ? await findAtsLinkInHtml(html, company.website)
      : null

    // Try common subpaths
    if (!result) {
      const paths = ['/careers', '/jobs', '/about']
      for (const p of paths) {
        const url = new URL(p, company.website).toString()
        const subHtml = await fetchHtml(url)
        if (!subHtml) continue

        result = await findAtsLinkInHtml(subHtml, url)
        if (result) break
      }
    }

    if (result) {
      console.log(`   ✅ Found ATS: ${result.provider} → ${result.atsUrl}`)
      await prisma.company.update({
        where: { id: company.id },
        data: {
          atsProvider: result.provider,
          atsUrl: result.atsUrl,
        },
      })
      updated++
    } else {
      console.log('   ⚠️ No ATS found')
    }

    await new Promise((r) => setTimeout(r, 1000))
  }

  console.log(`\n✨ Done. Updated ${updated} companies.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
