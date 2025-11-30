// scripts/dailyScrapeV2.ts
// Comprehensive daily scraper - ATS + All Board Scrapers
// Run:
//   Full:  npx tsx scripts/dailyScrapeV2.ts
//   ATS only:     npx tsx scripts/dailyScrapeV2.ts --mode=ats
//   Boards only:  npx tsx scripts/dailyScrapeV2.ts --mode=boards
//   Fast (skip heavy scrapers): npx tsx scripts/dailyScrapeV2.ts --fast

import { PrismaClient } from '@prisma/client'
import { ingestJob } from '../lib/ingest'

// 1. Core Board Scrapers
import scrapeRemoteOK from '../lib/scrapers/remoteok'
import { scrapeWeWorkRemotely } from '../lib/scrapers/weworkremotely'
import { scrapeNodesk } from '../lib/scrapers/nodesk'
import scrapeRemote100k from '../lib/scrapers/remote100k'

// 2. Dormant / Specialized Scrapers
import { scrapeWorkday } from '../lib/scrapers/workday'
import { scrapeYCombinator } from '../lib/scrapers/ycombinator'
import { scrapeRemotive } from '../lib/scrapers/remotive'
import scrapeRemoteRocketship from '../lib/scrapers/remoterocketship'
import scrapeGenericSources from '../lib/scrapers/generic'

const prisma = new PrismaClient()

// ============================================
// CONFIGURATION
// ============================================

// How many ATS companies to scrape in parallel
// 10 is safe for 'fetch' based scrapers. If using Puppeteer for ATS, lower to 3.
const CONCURRENCY_LIMIT = 10

type Mode = 'all' | 'ats' | 'boards'

interface CliOptions {
  mode: Mode
  fast: boolean
}

// Simple CLI arg parser
function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)
  let mode: Mode = 'all'
  let fast = false

  for (const arg of args) {
    if (arg === '--fast') fast = true
    if (arg.startsWith('--mode=')) {
      const val = arg.split('=')[1] as Mode | undefined
      if (val === 'ats' || val === 'boards' || val === 'all') {
        mode = val
      }
    }
  }

  return { mode, fast }
}

// ============================================
// ATS SCRAPERS (Inline Helpers)
// ============================================

async function scrapeGreenhouse(slug: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
      {
        headers: { 'User-Agent': 'SixFigureJobs/1.0' },
        signal: AbortSignal.timeout(10000),
      },
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.jobs || []).map((job: any) => ({
      externalId: `gh-${job.id}`,
      title: job.title,
      location: job.location?.name || 'Remote',
      url: job.absolute_url,
      description: job.content || '',
      postedAt: job.updated_at ? new Date(job.updated_at) : new Date(),
    }))
  } catch {
    return []
  }
}

async function scrapeLever(slug: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${slug}?mode=json`,
      {
        headers: { 'User-Agent': 'SixFigureJobs/1.0' },
        signal: AbortSignal.timeout(10000),
      },
    )
    if (!res.ok) return []
    const jobs = await res.json()
    return (jobs || []).map((job: any) => ({
      externalId: `lever-${job.id}`,
      title: job.text,
      location: job.categories?.location || 'Remote',
      url: job.hostedUrl || job.applyUrl,
      description: job.descriptionPlain || job.description || '',
      postedAt: job.createdAt ? new Date(job.createdAt) : new Date(),
    }))
  } catch {
    return []
  }
}

async function scrapeAshby(slug: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
      {
        headers: { 'User-Agent': 'SixFigureJobs/1.0' },
        signal: AbortSignal.timeout(10000),
      },
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.jobs || []).map((job: any) => ({
      externalId: `ashby-${job.id}`,
      title: job.title,
      location: job.location || 'Remote',
      url: `https://jobs.ashbyhq.com/${slug}/${job.id}`,
      description: job.descriptionHtml || job.descriptionPlain || '',
      postedAt: new Date(),
    }))
  } catch {
    return []
  }
}

// ============================================
// ATS JOB INGEST
// ============================================

async function ingestATSJob(
  job: any,
  companyName: string,
  companyWebsite: string | null,
  source: string,
) {
  return ingestJob({
    externalId: job.externalId,
    title: job.title,
    rawCompanyName: companyName,
    companyWebsiteUrl: companyWebsite,
    locationText: job.location,
    url: job.url,
    applyUrl: job.url,
    descriptionText: null,
    descriptionHtml: job.description,
    postedAt: job.postedAt,
    source,
    isRemote: /remote/i.test(job.location || ''),
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryInterval: null,
    employmentType: null,
  })
}

// ============================================
// MAIN
// ============================================

async function main() {
  const { mode, fast } = parseCliArgs()

  console.log('\n' + '='.repeat(60))
  console.log('🚀 Starting Comprehensive Daily Scrape (V2 - High Performance)')
  console.log(`   Mode: ${mode.toUpperCase()}   Fast: ${fast ? 'YES' : 'NO'}`)
  console.log('='.repeat(60) + '\n')

  let totalNew = 0,
    totalUpdated = 0

  // ─────────────────────────────────────────────────────────────
  // PART 1: ATS Companies (Greenhouse, Lever, Ashby, Workday)
  // ─────────────────────────────────────────────────────────────
  if (mode === 'all' || mode === 'ats') {
    console.log('━━━ PART 1: ATS Companies ━━━\n')

    const companies = await prisma.company.findMany({
      where: { atsUrl: { not: null } },
      select: {
        id: true,
        name: true,
        slug: true,
        atsUrl: true,
        website: true,
        atsProvider: true,
        atsSlug: true,
      },
    })

    console.log(
      `Found ${companies.length} ATS companies. Processing in batches of ${CONCURRENCY_LIMIT}...\n`,
    )

    for (let i = 0; i < companies.length; i += CONCURRENCY_LIMIT) {
      const batch = companies.slice(i, i + CONCURRENCY_LIMIT)

      const results = await Promise.all(
        batch.map(async (company) => {
          const slug =
            company.atsSlug || company.atsUrl?.split('/').pop() || ''
          if (!slug && !company.atsUrl) return { new: 0, updated: 0 }

          let jobs: any[] = []
          let source = ''
          const provider = company.atsProvider || ''
          const url = company.atsUrl || ''

          try {
            if (provider === 'greenhouse' || url.includes('greenhouse')) {
              jobs = await scrapeGreenhouse(slug)
              source = 'ats:greenhouse'
            } else if (provider === 'lever' || url.includes('lever')) {
              jobs = await scrapeLever(slug)
              source = 'ats:lever'
            } else if (provider === 'ashby' || url.includes('ashby')) {
              jobs = await scrapeAshby(slug)
              source = 'ats:ashby'
            } else if (
              !fast && // Workday is slower → skip in fast mode
              (provider === 'workday' || url.includes('myworkdayjobs'))
            ) {
              jobs = await scrapeWorkday(url)
              source = 'ats:workday'
            } else {
              return { new: 0, updated: 0 }
            }

            let batchNew = 0
            let batchUpdated = 0

            for (const job of jobs) {
              const result = await ingestATSJob(
                job,
                company.name,
                company.website,
                source,
              )
              if (result.status === 'created') batchNew++
              else if (
                result.status === 'updated' ||
                result.status === 'upgraded'
              )
                batchUpdated++
            }

            if (jobs.length > 0) {
              console.log(
                `  ✓ ${company.name}: ${jobs.length} jobs (${batchNew} new, ${batchUpdated} updated)`,
              )
            }
            return { new: batchNew, updated: batchUpdated }
          } catch (err: any) {
            console.error(
              `  ✗ ${company.name}: ${String(err.message || err).slice(0, 80)}`,
            )
            return { new: 0, updated: 0 }
          }
        }),
      )

      results.forEach((r) => {
        totalNew += r.new
        totalUpdated += r.updated
      })
    }
  } else {
    console.log('⏩ Skipping ATS Companies (mode != ats/all)\n')
  }

  // ─────────────────────────────────────────────────────────────
  // PART 2: Job Boards
  // ─────────────────────────────────────────────────────────────
  if (mode === 'all' || mode === 'boards') {
    console.log('\n━━━ PART 2: Job Boards ━━━\n')

    // Remote100k (likely Puppeteer-heavy) → keep sequential for safety
    if (!fast) {
      try {
        console.log('  Scraping Remote100k (Puppeteer)...')
        const result = await scrapeRemote100k()
        console.log(
          `  ✓ Remote100k: ${result.created} new, ${result.updated} updated`,
        )
        totalNew += result.created
        totalUpdated += result.updated
      } catch (err: any) {
        console.error(
          `  ✗ Remote100k: ${String(err.message || err).slice(0, 80)}`,
        )
      }
    } else {
      console.log('  ⏩ Skipping Remote100k in fast mode')
    }

    // These HTTP-only scrapers can run in parallel
    const boardTasks: Array<Promise<{ new: number; updated: number }>> = []

    boardTasks.push(
      (async () => {
        try {
          console.log('  Scraping RemoteOK...')
          const result = await scrapeRemoteOK()
          console.log(
            `  ✓ RemoteOK: ${result.jobsNew} new, ${result.jobsUpdated} updated`,
          )
          return { new: result.jobsNew ?? 0, updated: result.jobsUpdated ?? 0 }
        } catch (err: any) {
          console.error(
            `  ✗ RemoteOK: ${String(err.message || err).slice(0, 80)}`,
          )
          return { new: 0, updated: 0 }
        }
      })(),
    )

    boardTasks.push(
      (async () => {
        try {
          console.log('  Scraping WeWorkRemotely...')
          const jobs = await scrapeWeWorkRemotely()
          console.log(`  ✓ WeWorkRemotely: ${jobs.length} jobs found`)
          // This scraper currently doesn't ingest via ingestJob here,
          // so we don't add to totals.
          return { new: 0, updated: 0 }
        } catch (err: any) {
          console.error(
            `  ✗ WeWorkRemotely: ${String(err.message || err).slice(0, 80)}`,
          )
          return { new: 0, updated: 0 }
        }
      })(),
    )

    boardTasks.push(
      (async () => {
        try {
          console.log('  Scraping Nodesk...')
          const jobs = await scrapeNodesk()
          console.log(`  ✓ Nodesk: ${jobs.length} jobs found`)
          // Same as WWR: just logging count.
          return { new: 0, updated: 0 }
        } catch (err: any) {
          console.error(
            `  ✗ Nodesk: ${String(err.message || err).slice(0, 80)}`,
          )
          return { new: 0, updated: 0 }
        }
      })(),
    )

    const boardResults = await Promise.all(boardTasks)
    boardResults.forEach((r) => {
      totalNew += r.new
      totalUpdated += r.updated
    })
  } else {
    console.log('\n⏩ Skipping Job Boards (mode != boards/all)')
  }

  // ─────────────────────────────────────────────────────────────
  // PART 3: Additional Sources
  // ─────────────────────────────────────────────────────────────
  if (mode === 'all' || mode === 'boards') {
    console.log('\n━━━ PART 3: Additional Sources ━━━\n')

    const extraTasks: Array<Promise<{ source: string; new: number; updated: number }>> =
      []

    if (!fast) {
      // Generic career pages
      extraTasks.push(
        (async () => {
          try {
            console.log('  Scraping Generic Career Pages...')
            const result = await scrapeGenericSources()
            console.log(
              `  ✓ Generic Sources: ${result.created} new, ${result.updated} updated`,
            )
            return {
              source: 'generic',
              new: result.created ?? 0,
              updated: result.updated ?? 0,
            }
          } catch (err: any) {
            console.error(
              `  ✗ Generic Sources: ${String(err.message || err).slice(0, 80)}`,
            )
            return { source: 'generic', new: 0, updated: 0 }
          }
        })(),
      )

      // YCombinator
      extraTasks.push(
        (async () => {
          try {
            console.log('  Scraping YCombinator...')
            await scrapeYCombinator()
            console.log('  ✓ YCombinator: Scrape complete')
            // Not adding to totals here (same as before)
            return { source: 'yc', new: 0, updated: 0 }
          } catch (err: any) {
            console.error(
              `  ✗ YCombinator: ${String(err.message || err).slice(0, 80)}`,
            )
            return { source: 'yc', new: 0, updated: 0 }
          }
        })(),
      )

      // Remotive
      extraTasks.push(
        (async () => {
          try {
            console.log('  Scraping Remotive...')
            await scrapeRemotive()
            console.log('  ✓ Remotive: Scrape complete')
            return { source: 'remotive', new: 0, updated: 0 }
          } catch (err: any) {
            console.error(
              `  ✗ Remotive: ${String(err.message || err).slice(0, 80)}`,
            )
            return { source: 'remotive', new: 0, updated: 0 }
          }
        })(),
      )

      // Remote Rocketship
      extraTasks.push(
        (async () => {
          try {
            console.log('  Scraping Remote Rocketship...')
            await scrapeRemoteRocketship()
            console.log('  ✓ Remote Rocketship: Scrape complete')
            return { source: 'remote-rocketship', new: 0, updated: 0 }
          } catch (err: any) {
            console.error(
              `  ✗ Remote Rocketship: ${String(err.message || err).slice(0, 80)}`,
            )
            return { source: 'remote-rocketship', new: 0, updated: 0 }
          }
        })(),
      )
    } else {
      console.log(
        '  ⏩ Skipping Generic, YC, Remotive, Remote Rocketship in fast mode',
      )
    }

    const extraResults = await Promise.all(extraTasks)
    extraResults.forEach((r) => {
      if (r.source === 'generic') {
        totalNew += r.new
        totalUpdated += r.updated
      }
    })
  }

  // ─────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log('✅ COMPLETE')
  console.log('='.repeat(60) + '\n')

  const totalJobs = await prisma.job.count({ where: { isExpired: false } })
  const highSalaryJobs = await prisma.job.count({
    where: { isExpired: false, isHighSalary: true },
  })
  const totalCompanies = await prisma.company.count()

  console.log('📊 Database Summary:')
  console.log(
    `   ${totalJobs.toLocaleString()} active jobs (${highSalaryJobs.toLocaleString()} high-salary)`,
  )
  console.log(`   ${totalCompanies.toLocaleString()} companies`)
  console.log(
    `   This run created ${totalNew.toLocaleString()} new jobs and updated ${totalUpdated.toLocaleString()} jobs`,
  )

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
