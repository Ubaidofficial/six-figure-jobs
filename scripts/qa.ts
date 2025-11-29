import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

interface QAResult {
  category: string
  check: string
  status: 'pass' | 'fail' | 'warn'
  message: string
}

const results: QAResult[] = []

function log(category: string, check: string, status: 'pass' | 'fail' | 'warn', message: string) {
  results.push({ category, check, status, message })
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️'
  console.log(`${icon} [${category}] ${check}: ${message}`)
}

async function checkDatabase() {
  console.log('\n══════════════════════════════════════')
  console.log('  📊 DATABASE CHECKS')
  console.log('══════════════════════════════════════\n')

  const totalJobs = await prisma.job.count({ where: { isExpired: false } })
  if (totalJobs > 5000) log('Database', 'Total Jobs', 'pass', `${totalJobs.toLocaleString()} active jobs`)
  else if (totalJobs > 1000) log('Database', 'Total Jobs', 'warn', `${totalJobs.toLocaleString()} jobs`)
  else log('Database', 'Total Jobs', 'fail', `Only ${totalJobs} jobs`)

  const highSalary = await prisma.job.count({
    where: { isExpired: false, OR: [{ salaryMin: { gte: 100000 } }, { salaryMax: { gte: 100000 } }] }
  })
  const pct = ((highSalary / totalJobs) * 100).toFixed(1)
  log('Database', 'High-Salary Jobs', highSalary > 3000 ? 'pass' : 'warn', `${highSalary.toLocaleString()} (${pct}%)`)

  const totalCompanies = await prisma.company.count()
  const withAts = await prisma.company.count({ where: { atsUrl: { not: null } } })
  log('Database', 'Companies', 'pass', `${totalCompanies.toLocaleString()} total, ${withAts} with ATS`)

  const greenhouse = await prisma.company.count({ where: { atsUrl: { contains: 'greenhouse' } } })
  const lever = await prisma.company.count({ where: { atsUrl: { contains: 'lever' } } })
  const ashby = await prisma.company.count({ where: { atsUrl: { contains: 'ashby' } } })
  log('Database', 'ATS Distribution', 'pass', `GH: ${greenhouse}, Lever: ${lever}, Ashby: ${ashby}`)

  const failedScrapes = await prisma.company.count({ where: { scrapeStatus: 'failed' } })
  if (failedScrapes === 0) log('Database', 'Scrape Failures', 'pass', 'No failed scrapes')
  else log('Database', 'Scrape Failures', failedScrapes < 10 ? 'warn' : 'fail', `${failedScrapes} failed`)

  const outliers = await prisma.job.count({ where: { isExpired: false, salaryMax: { gt: 1000000 } } })
  log('Database', 'Salary Outliers', outliers === 0 ? 'pass' : 'warn', outliers === 0 ? 'None' : `${outliers} jobs > $1M`)

  const currencies = await prisma.job.groupBy({
    by: ['salaryCurrency'],
    where: { isExpired: false, salaryCurrency: { not: null } },
    _count: true,
    orderBy: { _count: { salaryCurrency: 'desc' } },
    take: 5
  })
  log('Database', 'Currencies', 'pass', currencies.map(c => `${c.salaryCurrency}: ${c._count.toLocaleString()}`).join(', '))
}

async function checkAPIs() {
  console.log('\n══════════════════════════════════════')
  console.log('  🌐 API CONNECTIVITY')
  console.log('══════════════════════════════════════\n')

  const apis = [
    { name: 'Greenhouse', url: 'https://boards-api.greenhouse.io/v1/boards/anthropic/jobs' },
    { name: 'Lever', url: 'https://api.lever.co/v0/postings/spotify' },
    { name: 'Ashby', url: 'https://api.ashbyhq.com/posting-api/job-board/openai' },
  ]

  for (const api of apis) {
    try {
      const res = await fetch(api.url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'QA/1.0' } })
      log('API', api.name, res.ok ? 'pass' : 'warn', res.ok ? 'OK' : `HTTP ${res.status}`)
    } catch (e: any) {
      log('API', api.name, 'warn', 'Timeout (network issue)')
    }
  }
}

async function checkFiles() {
  console.log('\n══════════════════════════════════════')
  console.log('  📁 CORE FILES')
  console.log('══════════════════════════════════════\n')

  const required = [
    'scripts/dailyScrape.ts', 'scripts/discoverATSSlugs.ts', 'lib/ingest/index.ts',
    'prisma/schema.prisma', 'app/page.tsx', 'app/sitemap.xml/route.ts'
  ]
  const missing = required.filter(f => !fs.existsSync(f))
  log('Files', 'Core Files', missing.length === 0 ? 'pass' : 'fail', 
    missing.length === 0 ? `All ${required.length} exist` : `Missing: ${missing.join(', ')}`)
}

async function checkSEO() {
  console.log('\n══════════════════════════════════════')
  console.log('  🔍 SEO')
  console.log('══════════════════════════════════════\n')

  const sitemaps = ['app/sitemap.xml', 'app/sitemap-jobs.xml', 'app/sitemap-company.xml'].filter(s => fs.existsSync(s))
  const pages = ['app/remote/[role]/page.tsx', 'app/salary/[role]/page.tsx', 'app/jobs/100k-plus/page.tsx'].filter(p => fs.existsSync(p))
  
  log('SEO', 'Sitemaps', sitemaps.length >= 3 ? 'pass' : 'warn', `${sitemaps.length} sitemaps`)
  log('SEO', 'SEO Pages', pages.length >= 2 ? 'pass' : 'warn', `${pages.length} programmatic pages`)
}

async function checkScraperHealth() {
  console.log('\n══════════════════════════════════════')
  console.log('  🔄 SCRAPER STATUS')
  console.log('══════════════════════════════════════\n')

  // Check from database, not old logs
  const withAts = await prisma.company.count({ where: { atsUrl: { not: null } } })
  const successful = await prisma.company.count({ where: { scrapeStatus: 'success' } })
  const failed = await prisma.company.count({ where: { scrapeStatus: 'failed' } })
  
  log('Scraper', 'Companies', 'pass', `${withAts} with ATS URLs`)
  log('Scraper', 'Success Rate', failed === 0 ? 'pass' : 'warn', `${successful} success, ${failed} failed`)

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await prisma.company.count({ where: { atsUrl: { not: null }, lastScrapedAt: { gte: oneDayAgo } } })
  log('Scraper', 'Freshness', recent >= withAts * 0.9 ? 'pass' : 'warn', `${recent}/${withAts} scraped in 24h`)
}

async function main() {
  console.log('╔═══════════════════════════════════════════════╗')
  console.log('║     🔍 Remote100k QA Health Check             ║')
  console.log('╚═══════════════════════════════════════════════╝')

  await checkDatabase()
  await checkAPIs()
  await checkFiles()
  await checkSEO()
  await checkScraperHealth()

  const passed = results.filter(r => r.status === 'pass').length
  const warned = results.filter(r => r.status === 'warn').length
  const failed = results.filter(r => r.status === 'fail').length

  console.log('\n══════════════════════════════════════')
  console.log('  📋 SUMMARY')
  console.log('══════════════════════════════════════')
  console.log(`\n  ✅ Passed: ${passed}  ⚠️ Warnings: ${warned}  ❌ Failed: ${failed}`)

  if (failed > 0) {
    console.log('\n  ❌ FAILURES:')
    results.filter(r => r.status === 'fail').forEach(r => console.log(`    • ${r.check}: ${r.message}`))
  }
  if (warned > 0) {
    console.log('\n  ⚠️ WARNINGS:')
    results.filter(r => r.status === 'warn').forEach(r => console.log(`    • ${r.check}: ${r.message}`))
  }

  console.log('\n══════════════════════════════════════\n')
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(console.error)
