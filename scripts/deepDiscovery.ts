// scripts/deepDiscovery.ts

import { createHash } from 'node:crypto'
import puppeteer, { Page } from 'puppeteer'
import { prisma } from '../lib/prisma'
import { makeBoardSource } from '../lib/ingest/sourcePriority'

// =============================================================================
// Configuration
// =============================================================================

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const ATS_PATTERNS = [
  { provider: 'greenhouse', regex: /boards\.greenhouse\.io\/([^/"'?]+)/ },
  { provider: 'greenhouse', regex: /greenhouse\.io\/embed\/job_board\?for=([^&"']+)/ },
  { provider: 'lever', regex: /jobs\.lever\.co\/([^/"'?]+)/ },
  { provider: 'ashby', regex: /jobs\.ashbyhq\.com\/([^/"'?]+)/ },
  { provider: 'ashby', regex: /api\.ashbyhq\.com\/posting-api\/job-board\/([^/"'?]+)/ },
  { provider: 'workday', regex: /([^/"'?]+)\.wd1\.myworkdayjobs\.com/ },
  { provider: 'bamboo', regex: /([^/"'?]+)\.bamboohr\.com\/jobs/ },
] as const

const JOB_TITLE_KEYWORDS = [
  'engineer',
  'developer',
  'manager',
  'designer',
  'product',
  'sales',
  'marketing',
  'analyst',
  'lead',
  'head of',
  'vp',
  'director',
  'counsel',
  'recruiter',
  'support',
  'success',
]

// =============================================================================
// Main Script
// =============================================================================

async function main() {
  console.log('🚀 Starting Deep Company Discovery (Puppeteer + Generic Fallback)...')

  const companies = await prisma.company.findMany({
    where: {
      atsProvider: null,
      name: { not: 'Add Your Company' },
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
  })

  console.log(`📋 Scanning ${companies.length} companies...`)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    for (const company of companies) {
      const page = await browser.newPage()
      await page.setUserAgent(USER_AGENT)

      try {
        await processCompany(company, page)
      } catch (err) {
        console.error(`❌ Error processing ${company.name}:`, err)
      } finally {
        await page.close()
      }

      await sleep(1000)
    }
  } finally {
    await browser.close()
  }
}

// =============================================================================
// Processing Logic
// =============================================================================

async function processCompany(company: any, page: Page) {
  process.stdout.write(`\n🔍 ${company.name}: `)

  const candidates: string[] = buildCandidateUrls(company)

  let foundSomething = false

  for (const candidateUrl of candidates) {
    if (foundSomething) break

    try {
      const url = normalizeUrl(candidateUrl)
      if (!url) continue

      const response = await page
        .goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        .catch(() => null)

      if (!response || !response.ok()) continue

      // A) ATS detection
      const atsResult = await detectATS(page)
      if (atsResult) {
        console.log(`✅ FOUND ATS: ${atsResult.provider} (${atsResult.slug})`)

        await prisma.company.update({
          where: { id: company.id },
          data: {
            website: getBaseUrl(url),
            atsProvider: atsResult.provider,
            atsSlug: atsResult.slug,
            atsUrl: url,
          },
        })

        await prisma.companySource.upsert({
          where: { companyId_url: { companyId: company.id, url } },
          create: {
            companyId: company.id,
            url,
            sourceType: 'ats_careers_page',
            atsProvider: atsResult.provider,
            isActive: true,
          },
          update: {
            atsProvider: atsResult.provider,
            lastScrapedAt: new Date(),
          },
        })

        foundSomething = true
        continue
      }

      // B) Generic scrape (fallback)
      const isLikelyCareersPage =
        url.includes('/careers') || url.includes('/jobs') || candidates.indexOf(candidateUrl) === 0

      if (isLikelyCareersPage) {
        const genericJobs = await scanGenericJobs(page)

        if (genericJobs.length > 0) {
          console.log(`✅ GENERIC SCRAPE: Found ${genericJobs.length} potential jobs on ${url}`)

          await prisma.company.update({
            where: { id: company.id },
            data: { website: getBaseUrl(url) },
          })

          await prisma.companySource.upsert({
            where: { companyId_url: { companyId: company.id, url } },
            create: {
              companyId: company.id,
              url,
              sourceType: 'generic_careers_page',
              isActive: true,
              scrapeStatus: 'active',
            },
            update: { lastScrapedAt: new Date() },
          })

          // Save discovered jobs (bootstrap)
          let newJobs = 0
          for (const job of genericJobs) {
            const jobUrl = normalizeUrl(job.url)
            if (!jobUrl) continue

            // Deterministic ID to reduce duplicates: hash(companyId + jobUrl)
            const id = stableJobId(company.id, jobUrl)

            // IMPORTANT:
            // - Do NOT write `shortId` unless you actually add it to Prisma schema + migrate.
            // - v2.8 can compute short stable id from job.id at runtime.
            await prisma.job.upsert({
              where: { id },
              create: {
                id,
                title: job.title?.trim() || 'Job',
                company: company.name,
                companyId: company.id,
                url: jobUrl,
                applyUrl: jobUrl,
                source: makeBoardSource('generic_discovery'),
                descriptionHtml: 'Discovered via generic scrape',
                postedAt: new Date(),
                isHighSalary: false,
              },
              update: {
                // keep it light—don’t overwrite good data if later pipelines enriched it
                title: job.title?.trim() || undefined,
                url: jobUrl,
                applyUrl: jobUrl,
                updatedAt: new Date(),
              },
            })

            newJobs++
          }

          console.log(`   -> Upserted ${newJobs} jobs to DB`)
          foundSomething = true
        }
      }
    } catch {
      // ignore navigation errors for guesses
    }
  }

  if (!foundSomething) {
    process.stdout.write('❌ No ATS or Job Links found')
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

async function detectATS(page: Page): Promise<{ provider: string; slug: string } | null> {
  const url = page.url()
  for (const p of ATS_PATTERNS) {
    const match = url.match(p.regex)
    if (match && match[1]) return { provider: p.provider, slug: match[1] }
  }

  const content = await page.content()
  for (const p of ATS_PATTERNS) {
    const match = content.match(p.regex)
    if (match && match[1]) return { provider: p.provider, slug: match[1] }
  }

  const frames = page.frames()
  for (const frame of frames) {
    try {
      const frameUrl = frame.url()
      for (const p of ATS_PATTERNS) {
        const match = frameUrl.match(p.regex)
        if (match && match[1]) return { provider: p.provider, slug: match[1] }
      }
    } catch {
      // ignore
    }
  }

  return null
}

async function scanGenericJobs(page: Page): Promise<Array<{ title: string; url: string }>> {
  return await page.evaluate((keywords) => {
    const links = Array.from(document.querySelectorAll('a'))
    const results: { title: string; url: string }[] = []

    const hasJobKeyword = (text: string) => {
      const t = text.toLowerCase()
      return keywords.some((k: string) => t.includes(k))
    }

    const isBadLink = (text: string) => {
      const t = text.toLowerCase()
      return (
        t.includes('login') ||
        t.includes('sign up') ||
        t.includes('policy') ||
        t.includes('privacy') ||
        t.includes('terms') ||
        t.length > 100
      )
    }

    links.forEach((link) => {
      const text = (link as HTMLAnchorElement).innerText?.trim() || ''
      const href = (link as HTMLAnchorElement).href || ''

      if (text && href && hasJobKeyword(text) && !isBadLink(text)) {
        if (!results.find((r) => r.url === href)) {
          results.push({ title: text, url: href })
        }
      }
    })

    return results
  }, JOB_TITLE_KEYWORDS)
}

function buildCandidateUrls(company: any): string[] {
  const candidates: string[] = []

  if (company.website) {
    const base = normalizeUrl(company.website) || company.website
    candidates.push(base)
    candidates.push(base.replace(/\/$/, '') + '/careers')
    candidates.push(base.replace(/\/$/, '') + '/jobs')
  } else {
    const cleanName = String(company.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

    if (cleanName) {
      candidates.push(`https://${cleanName}.com`)
      candidates.push(`https://${cleanName}.com/careers`)
      candidates.push(`https://${cleanName}.io`)
      candidates.push(`https://${cleanName}.app`)
    }
  }

  return candidates
}

function getBaseUrl(url: string) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.hostname}`
  } catch {
    return url
  }
}

function normalizeUrl(u: string): string | null {
  const s = String(u || '').trim()
  if (!s) return null
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  // Avoid turning weird relative junk into https://
  if (s.startsWith('/')) return null
  return `https://${s}`
}

function stableJobId(companyId: string, jobUrl: string): string {
  // deterministic “id” that is stable across re-runs
  // Format: generic:<companyId>:<sha1(url)[:16]>
  const hash = createHash('sha1').update(jobUrl).digest('hex').slice(0, 16)
  return `generic:${companyId}:${hash}`
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

main().catch(console.error)
