// scripts/audit-job-quality.ts
// Comprehensive data quality audit
import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

async function main() {
  __slog('🔍 SixFigureJobs Data Quality Audit')
  __slog('====================================\n')

  // Get recent jobs (last 7 days)
  const recentJobs = await prisma.job.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      isExpired: false
    },
    select: {
      id: true,
      title: true,
      source: true,
      descriptionHtml: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      salaryValidated: true,
      salaryConfidence: true,
      salarySource: true,
      locationRaw: true,
      primaryLocation: true,
      locationsJson: true,
      aiOneLiner: true,
      aiSnippet: true,
      aiSummaryJson: true,
      aiEnrichedAt: true,
      company: true,
      companyLogo: true,
      companyId: true,
      companyRef: {
        select: {
          name: true,
          logoUrl: true,
          website: true
        }
      }
    },
    take: 1000
  })

  __slog(`📊 Sample Size: ${recentJobs.length} jobs (last 7 days)\n`)

  if (recentJobs.length === 0) {
    __slog('⚠️  No jobs found in last 7 days. Checking all time...\n')
    
    const allJobs = await prisma.job.findMany({
      where: { isExpired: false },
      select: {
        id: true,
        title: true,
        source: true,
        descriptionHtml: true,
        minAnnual: true,
        maxAnnual: true,
        currency: true,
        salaryValidated: true,
        aiOneLiner: true,
        aiEnrichedAt: true,
        createdAt: true
      },
      take: 100,
      orderBy: { createdAt: 'desc' }
    })
    
    __slog(`Found ${allJobs.length} total active jobs`)
    if (allJobs.length > 0) {
      __slog(`Most recent job: ${allJobs[0].createdAt}`)
    }
    return
  }

  // 1. AI ENRICHMENT AUDIT
  __slog('🤖 AI ENRICHMENT STATUS')
  __slog('========================')
  
  const aiEnriched = recentJobs.filter(j => j.aiOneLiner)
  const aiEnrichedPercent = ((aiEnriched.length / recentJobs.length) * 100).toFixed(1)
  
  __slog(`AI Enriched: ${aiEnriched.length}/${recentJobs.length} (${aiEnrichedPercent}%)`)
  __slog(`- aiOneLiner: ${recentJobs.filter(j => j.aiOneLiner).length}`)
  __slog(`- aiSnippet: ${recentJobs.filter(j => j.aiSnippet).length}`)
  __slog(`- aiSummaryJson: ${recentJobs.filter(j => j.aiSummaryJson).length}`)
  __slog(`- aiEnrichedAt: ${recentJobs.filter(j => j.aiEnrichedAt).length}\n`)

  if (aiEnriched.length > 0) {
    const sample = aiEnriched[0]
    __slog('Sample AI Enrichment:')
    __slog(`  Job: ${sample.title}`)
    __slog(`  OneLiner: ${sample.aiOneLiner?.slice(0, 100)}...`)
    __slog(`  Snippet: ${sample.aiSnippet?.slice(0, 100)}...`)
    if (sample.aiSummaryJson) {
      __slog(`  Summary: ${JSON.stringify(sample.aiSummaryJson).slice(0, 100)}...\n`)
    }
  } else {
    __slog('⚠️  No AI-enriched jobs found. AI enrichment may not be running.\n')
  }

  // 2. SALARY DATA AUDIT
  __slog('💰 SALARY DATA QUALITY')
  __slog('=======================')
  
  const withSalary = recentJobs.filter(j => j.minAnnual && j.maxAnnual)
  const salaryPercent = ((withSalary.length / recentJobs.length) * 100).toFixed(1)
  
  __slog(`With Salary: ${withSalary.length}/${recentJobs.length} (${salaryPercent}%)`)
  __slog(`Salary Validated: ${recentJobs.filter(j => j.salaryValidated).length}`)
  __slog(`Salary Confidence > 0: ${recentJobs.filter(j => j.salaryConfidence && j.salaryConfidence > 0).length}`)
  
  // Currency breakdown
  const currencyBreakdown: Record<string, number> = {}
  withSalary.forEach(j => {
    const curr = j.currency || 'NULL'
    currencyBreakdown[curr] = (currencyBreakdown[curr] || 0) + 1
  })
  
  __slog('\nCurrency Breakdown:')
  Object.entries(currencyBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([curr, count]) => {
      __slog(`  ${curr}: ${count}`)
    })

  // Salary ranges
  if (withSalary.length > 0) {
    const salaryRanges = {
      '100k-150k': withSalary.filter(j => j.minAnnual! >= 100000n && j.minAnnual! < 150000n).length,
      '150k-200k': withSalary.filter(j => j.minAnnual! >= 150000n && j.minAnnual! < 200000n).length,
      '200k-300k': withSalary.filter(j => j.minAnnual! >= 200000n && j.minAnnual! < 300000n).length,
      '300k+': withSalary.filter(j => j.minAnnual! >= 300000n).length,
    }
    
    __slog('\nSalary Ranges (minAnnual):')
    Object.entries(salaryRanges).forEach(([range, count]) => {
      __slog(`  ${range}: ${count}`)
    })
  }
  __slog()

  // 3. DESCRIPTION DATA AUDIT
  __slog('📝 DESCRIPTION QUALITY')
  __slog('=======================')
  
  const withDescHtml = recentJobs.filter(j => j.descriptionHtml && j.descriptionHtml.length > 100)
  
  __slog(`With HTML Description: ${withDescHtml.length}/${recentJobs.length}`)
  
  if (withDescHtml.length > 0) {
    const avgDescLength = withDescHtml.reduce((sum, j) => sum + (j.descriptionHtml?.length || 0), 0) / withDescHtml.length
    __slog(`Average Description Length: ${Math.round(avgDescLength)} chars`)
    
    const thinDescriptions = withDescHtml.filter(j => j.descriptionHtml!.length < 500)
    __slog(`Thin Descriptions (<500 chars): ${thinDescriptions.length}`)
  }
  __slog()

  // 4. LOCATION DATA AUDIT
  __slog('📍 LOCATION DATA QUALITY')
  __slog('=========================')
  
  const withLocation = recentJobs.filter(j => j.locationRaw)
  const withPrimaryLocation = recentJobs.filter(j => j.primaryLocation)
  const withLocationsJson = recentJobs.filter(j => j.locationsJson)
  
  __slog(`With locationRaw: ${withLocation.length}/${recentJobs.length}`)
  __slog(`With primaryLocation: ${withPrimaryLocation.length}/${recentJobs.length}`)
  __slog(`With locationsJson: ${withLocationsJson.length}/${recentJobs.length}\n`)

  // 5. COMPANY DATA AUDIT
  __slog('🏢 COMPANY DATA QUALITY')
  __slog('========================')
  
  const withCompanyId = recentJobs.filter(j => j.companyId)
  const withCompanyName = recentJobs.filter(j => j.companyRef?.name || j.company)
  const withCompanyLogo = recentJobs.filter(j => j.companyRef?.logoUrl || j.companyLogo)
  const withCompanyWebsite = recentJobs.filter(j => j.companyRef?.website)
  
  __slog(`With Company ID: ${withCompanyId.length}/${recentJobs.length}`)
  __slog(`With Company Name: ${withCompanyName.length}/${recentJobs.length}`)
  __slog(`With Company Logo: ${withCompanyLogo.length}/${recentJobs.length}`)
  __slog(`With Company Website: ${withCompanyWebsite.length}/${recentJobs.length}\n`)

  // 6. SOURCE BREAKDOWN
  __slog('📡 SOURCE BREAKDOWN')
  __slog('====================')
  
  const sourceBreakdown: Record<string, number> = {}
  recentJobs.forEach(j => {
    const source = j.source || 'NULL'
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1
  })
  
  Object.entries(sourceBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([source, count]) => {
      const percent = ((count / recentJobs.length) * 100).toFixed(1)
      __slog(`  ${source}: ${count} (${percent}%)`)
    })

  __slog()

  // 7. DATA COMPLETENESS SCORE
  __slog('⭐ DATA COMPLETENESS SCORE')
  __slog('===========================')
  
  const scores = recentJobs.map(j => {
    let score = 0
    let maxScore = 10
    
    if (j.title) score += 1
    if (j.descriptionHtml && j.descriptionHtml.length > 500) score += 2
    if (j.minAnnual && j.maxAnnual) score += 2
    if (j.salaryValidated) score += 1
    if (j.locationRaw) score += 1
    if (j.primaryLocation) score += 1
    if (j.companyRef?.name || j.company) score += 1
    if (j.aiOneLiner) score += 1
    
    return score
  })
  
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
  const avgPercent = ((avgScore / 10) * 100).toFixed(1)
  
  __slog(`Average Completeness: ${avgScore.toFixed(1)}/10 (${avgPercent}%)`)
  
  const excellent = scores.filter(s => s >= 9).length
  const good = scores.filter(s => s >= 7 && s < 9).length
  const fair = scores.filter(s => s >= 5 && s < 7).length
  const poor = scores.filter(s => s < 5).length
  
  __slog(`\nQuality Distribution:`)
  __slog(`  Excellent (9-10): ${excellent}`)
  __slog(`  Good (7-8): ${good}`)
  __slog(`  Fair (5-6): ${fair}`)
  __slog(`  Poor (<5): ${poor}`)

  await prisma.$disconnect()
}

main().catch(console.error)
