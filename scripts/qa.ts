// scripts/qa.ts
// Run with:
//   npx tsx scripts/qa.ts

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

type QAStatus = 'pass' | 'fail' | 'warn'

interface QAResult {
  category: string
  check: string
  status: QAStatus
  message: string
}

const results: QAResult[] = []
const ROOT = process.cwd()

function log(
  category: string,
  check: string,
  status: QAStatus,
  message: string
) {
  results.push({ category, check, status, message })
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️'
  console.log(`${icon} [${category}] ${check}: ${message}`)
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath))
}

/* -------------------------------------------------------------------------- */
/* DATABASE CHECKS                                                            */
/* -------------------------------------------------------------------------- */

async function checkDatabase() {
  console.log('\n══════════════════════════════════════')
  console.log('  📊 DATABASE CHECKS')
  console.log('══════════════════════════════════════\n')

  // -----------------------------------------------------------------------
  // Basic volumes
  // -----------------------------------------------------------------------
  const totalJobs = await prisma.job.count({ where: { isExpired: false } })
  if (totalJobs > 5000) {
    log(
      'Database',
      'Total Jobs',
      'pass',
      `${totalJobs.toLocaleString()} active jobs`
    )
  } else if (totalJobs > 1000) {
    log(
      'Database',
      'Total Jobs',
      'warn',
      `${totalJobs.toLocaleString()} jobs`
    )
  } else {
    log('Database', 'Total Jobs', 'fail', `Only ${totalJobs} jobs`)
  }

  const highSalary = await prisma.job.count({
    where: {
      isExpired: false,
      OR: [
        { maxAnnual: { gte: BigInt(100_000) } },
        { minAnnual: { gte: BigInt(100_000) } },
        { isHighSalary: true },
      ],
    },
  })

  const highPct =
    totalJobs === 0 ? 0 : (highSalary / totalJobs) * 100

  log(
    'Database',
    'High-Salary Jobs',
    highSalary > 3000 ? 'pass' : 'warn',
    `${highSalary.toLocaleString()} (${highPct.toFixed(1)}%)`
  )

  // -----------------------------------------------------------------------
  // Companies / ATS coverage
  // -----------------------------------------------------------------------
  const totalCompanies = await prisma.company.count()
  const withAts = await prisma.company.count({
    where: { atsUrl: { not: null } },
  })

  log(
    'Database',
    'Companies',
    'pass',
    `${totalCompanies.toLocaleString()} total, ${withAts} with ATS`
  )

  const greenhouse = await prisma.company.count({
    where: { atsUrl: { contains: 'greenhouse' } },
  })
  const lever = await prisma.company.count({
    where: { atsUrl: { contains: 'lever' } },
  })
  const ashby = await prisma.company.count({
    where: { atsUrl: { contains: 'ashby' } },
  })

  log(
    'Database',
    'ATS Distribution',
    'pass',
    `GH: ${greenhouse}, Lever: ${lever}, Ashby: ${ashby}`
  )

  const failedScrapes = await prisma.company.count({
    where: { scrapeStatus: 'failed' },
  })
  if (failedScrapes === 0) {
    log('Database', 'Scrape Failures', 'pass', 'No failed scrapes')
  } else {
    log(
      'Database',
      'Scrape Failures',
      failedScrapes < 10 ? 'warn' : 'fail',
      `${failedScrapes} failed`
    )
  }

  // -----------------------------------------------------------------------
  // Salary sanity (outliers) – JobCard uses minAnnual/maxAnnual/currency
  // -----------------------------------------------------------------------
  const outliers = await prisma.job.count({
    where: { isExpired: false, maxAnnual: { gt: BigInt(1_000_000) } },
  })
  log(
    'Database',
    'Salary Outliers',
    outliers === 0 ? 'pass' : 'warn',
    outliers === 0 ? 'None' : `${outliers} jobs > $1M`
  )

  // Jobs with any annual salary populated
  const jobsWithAnnual = await prisma.job.count({
    where: {
      isExpired: false,
      OR: [{ minAnnual: { not: null } }, { maxAnnual: { not: null } }],
    },
  })

  const jobsWithCurrency = await prisma.job.count({
    where: {
      isExpired: false,
      OR: [{ minAnnual: { not: null } }, { maxAnnual: { not: null } }],
      currency: { not: null },
    },
  })

  const currencyCoveragePct =
    jobsWithAnnual === 0
      ? 0
      : (jobsWithCurrency / jobsWithAnnual) * 100

  log(
    'Database',
    'Salary Currency Coverage',
    currencyCoveragePct >= 90
      ? 'pass'
      : currencyCoveragePct >= 70
      ? 'warn'
      : 'fail',
    `${jobsWithCurrency.toLocaleString()}/${jobsWithAnnual.toLocaleString()} jobs with salary have currency (${currencyCoveragePct.toFixed(
      1
    )}%)`
  )

  // -----------------------------------------------------------------------
  // Currencies (top 5, using currency field)
  // -----------------------------------------------------------------------
  const currencies = await prisma.job.groupBy({
    by: ['currency'],
    where: {
      isExpired: false,
      currency: { not: null },
    },
    _count: {
      currency: true,
    },
    orderBy: {
      _count: {
        currency: 'desc',
      },
    },
    take: 5,
  })

  log(
    'Database',
    'Currencies',
    'pass',
    currencies
      .map((c) => {
        const count = c._count?.currency ?? 0
        return `${c.currency ?? 'NULL'}: ${count.toLocaleString()}`
      })
      .join(', ')
  )

  // -----------------------------------------------------------------------
  // Company logo coverage (used on JobCard / Company pages)
  // -----------------------------------------------------------------------
  const withLogo = await prisma.company.count({
    where: { logoUrl: { not: null } },
  })

  const logoPct =
    totalCompanies === 0 ? 0 : (withLogo / totalCompanies) * 100

  log(
    'Database',
    'Company Logos',
    logoPct >= 60 ? 'pass' : logoPct >= 30 ? 'warn' : 'fail',
    `${withLogo.toLocaleString()}/${totalCompanies.toLocaleString()} companies (${logoPct.toFixed(
      1
    )}%) have logoUrl`
  )

  // -----------------------------------------------------------------------
  // Remote job location coverage: Remote (US / UK / etc) for filters
  // -----------------------------------------------------------------------
  const remoteJobs = await prisma.job.count({
    where: {
      isExpired: false,
      OR: [{ remote: true }, { remoteMode: 'remote' }],
    },
  })

  const remoteWithCountry = await prisma.job.count({
    where: {
      isExpired: false,
      OR: [{ remote: true }, { remoteMode: 'remote' }],
      countryCode: { not: null },
    },
  })

  const remoteCountryPct =
    remoteJobs === 0
      ? 0
      : (remoteWithCountry / remoteJobs) * 100

  log(
    'Database',
    'Remote Location Coverage',
    remoteCountryPct >= 70 ? 'pass' : 'warn',
    `${remoteWithCountry.toLocaleString()}/${remoteJobs.toLocaleString()} remote jobs (${remoteCountryPct.toFixed(
      1
    )}%) have countryCode`
  )

  // Top 5 remote countries (Remote – US / UK / etc)
  if (remoteJobs > 0) {
    const remoteByCountry = await prisma.job.groupBy({
      by: ['countryCode'],
      where: {
        isExpired: false,
        OR: [{ remote: true }, { remoteMode: 'remote' }],
        countryCode: { not: null },
      },
      _count: {
        countryCode: true,
      },
      orderBy: {
        _count: {
          countryCode: 'desc',
        },
      },
      take: 5,
    })

    log(
      'Database',
      'Remote by Country',
      'pass',
      remoteByCountry
        .map((c) => {
          const count = c._count?.countryCode ?? 0
          return `${c.countryCode ?? 'NULL'}: ${count.toLocaleString()}`
        })
        .join(', ')
    )
  }
}

/* -------------------------------------------------------------------------- */
/* API CONNECTIVITY                                                          */
/* -------------------------------------------------------------------------- */

async function checkAPIs() {
  console.log('\n══════════════════════════════════════')
  console.log('  🌐 API CONNECTIVITY')
  console.log('══════════════════════════════════════\n')

  const apis = [
    {
      name: 'Greenhouse',
      url: 'https://boards-api.greenhouse.io/v1/boards/anthropic/jobs',
    },
    {
      name: 'Lever',
      url: 'https://api.lever.co/v0/postings/spotify',
    },
    {
      name: 'Ashby',
      url: 'https://api.ashbyhq.com/posting-api/job-board/openai',
    },
  ]

  for (const api of apis) {
    try {
      const res = await fetch(api.url, {
        signal: AbortSignal.timeout(15_000),
        headers: { 'User-Agent': 'QA/1.0' },
      })
      log(
        'API',
        api.name,
        res.ok ? 'pass' : 'warn',
        res.ok ? 'OK' : `HTTP ${res.status}`
      )
    } catch {
      log('API', api.name, 'warn', 'Timeout or network error')
    }
  }
}

/* -------------------------------------------------------------------------- */
/* FILE / ROUTE CHECKS                                                       */
/* -------------------------------------------------------------------------- */

async function checkFiles() {
  console.log('\n══════════════════════════════════════')
  console.log('  📁 CORE FILES')
  console.log('══════════════════════════════════════\n')

  const required = [
    'scripts/dailyScrapeV2.ts',
    'scripts/resetDatabase.ts',
    'scripts/seed.ts',
    'lib/ingest/index.ts',
    'prisma/schema.prisma',
    'app/page.tsx',
    'app/sitemap.xml/route.ts',
  ]

  const missing = required.filter((f) => !exists(f))

  log(
    'Files',
    'Core Files',
    missing.length === 0 ? 'pass' : 'fail',
    missing.length === 0
      ? `All ${required.length} core files exist`
      : `Missing: ${missing.join(', ')}`
  )
}

/* -------------------------------------------------------------------------- */
/* SEO CHECKS                                                                */
/* -------------------------------------------------------------------------- */

async function checkSEO() {
  console.log('\n══════════════════════════════════════')
  console.log('  🔍 SEO')
  console.log('══════════════════════════════════════\n')

  const sitemapFiles = [
    'app/sitemap.xml/route.ts',
    'app/sitemap-jobs.xml/route.ts',
    'app/sitemap-company.xml/route.ts',
    'app/sitemap-remote.xml/route.ts',
    'app/sitemap-salary.xml/route.ts',
  ].filter(exists)

  log(
    'SEO',
    'Sitemaps',
    sitemapFiles.length >= 3 ? 'pass' : 'warn',
    `${sitemapFiles.length} sitemap route(s) present`
  )

  const seoPages = [
    'app/jobs/100k-plus/page.tsx',
    'app/jobs/[...slug]/page.tsx',
    'app/company/[slug]/page.tsx',
    'app/company/page.tsx',
  ].filter(exists)

  log(
    'SEO',
    'Programmatic Pages',
    seoPages.length >= 3 ? 'pass' : 'warn',
    `${seoPages.length} key programmatic SEO pages present`
  )
}

/* -------------------------------------------------------------------------- */
/* SCRAPER HEALTH                                                            */
/* -------------------------------------------------------------------------- */

async function checkScraperHealth() {
  console.log('\n══════════════════════════════════════')
  console.log('  🔄 SCRAPER STATUS')
  console.log('══════════════════════════════════════\n')

  const withAts = await prisma.company.count({
    where: { atsUrl: { not: null } },
  })
  const successful = await prisma.company.count({
    where: { scrapeStatus: 'success' },
  })
  const failed = await prisma.company.count({
    where: { scrapeStatus: 'failed' },
  })

  log(
    'Scraper',
    'Companies with ATS',
    'pass',
    `${withAts} companies have ATS URLs`
  )

  log(
    'Scraper',
    'Success Rate',
    failed === 0 ? 'pass' : 'warn',
    `${successful} success, ${failed} failed`
  )

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await prisma.company.count({
    where: {
      atsUrl: { not: null },
      lastScrapedAt: { gte: oneDayAgo },
    },
  })

  const freshnessPct =
    withAts === 0 ? 0 : (recent / withAts) * 100

  log(
    'Scraper',
    'Freshness (24h)',
    freshnessPct >= 90 ? 'pass' : 'warn',
    `${recent}/${withAts} ATS companies (${freshnessPct.toFixed(
      1
    )}%) scraped in last 24h`
  )
}

/* -------------------------------------------------------------------------- */
/* MAIN                                                                      */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log('╔═══════════════════════════════════════════════╗')
  console.log('║     🔍 Remote100k QA Health Check             ║')
  console.log('╚═══════════════════════════════════════════════╝')

  await checkDatabase()
  await checkAPIs()
  await checkFiles()
  await checkSEO()
  await checkScraperHealth()

  const passed = results.filter((r) => r.status === 'pass').length
  const warned = results.filter((r) => r.status === 'warn').length
  const failed = results.filter((r) => r.status === 'fail').length

  console.log('\n══════════════════════════════════════')
  console.log('  📋 SUMMARY')
  console.log('══════════════════════════════════════')
  console.log(
    `\n  ✅ Passed: ${passed}  ⚠️ Warnings: ${warned}  ❌ Failed: ${failed}`
  )

  if (failed > 0) {
    console.log('\n  ❌ FAILURES:')
    results
      .filter((r) => r.status === 'fail')
      .forEach((r) => console.log(`    • ${r.check}: ${r.message}`))
  }
  if (warned > 0) {
    console.log('\n  ⚠️ WARNINGS:')
    results
      .filter((r) => r.status === 'warn')
      .forEach((r) => console.log(`    • ${r.check}: ${r.message}`))
  }

  console.log('\n══════════════════════════════════════\n')
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
