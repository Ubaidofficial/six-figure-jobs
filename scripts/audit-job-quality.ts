// scripts/audit-job-quality.ts
// Comprehensive data quality audit
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 SixFigureJobs Data Quality Audit')
  console.log('====================================\n')

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

  console.log(`📊 Sample Size: ${recentJobs.length} jobs (last 7 days)\n`)

  if (recentJobs.length === 0) {
    console.log('⚠️  No jobs found in last 7 days. Checking all time...\n')
    
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
    
    console.log(`Found ${allJobs.length} total active jobs`)
    if (allJobs.length > 0) {
      console.log(`Most recent job: ${allJobs[0].createdAt}`)
    }
    return
  }

  // 1. AI ENRICHMENT AUDIT
  console.log('🤖 AI ENRICHMENT STATUS')
  console.log('========================')
  
  const aiEnriched = recentJobs.filter(j => j.aiOneLiner)
  const aiEnrichedPercent = ((aiEnriched.length / recentJobs.length) * 100).toFixed(1)
  
  console.log(`AI Enriched: ${aiEnriched.length}/${recentJobs.length} (${aiEnrichedPercent}%)`)
  console.log(`- aiOneLiner: ${recentJobs.filter(j => j.aiOneLiner).length}`)
  console.log(`- aiSnippet: ${recentJobs.filter(j => j.aiSnippet).length}`)
  console.log(`- aiSummaryJson: ${recentJobs.filter(j => j.aiSummaryJson).length}`)
  console.log(`- aiEnrichedAt: ${recentJobs.filter(j => j.aiEnrichedAt).length}\n`)

  if (aiEnriched.length > 0) {
    const sample = aiEnriched[0]
    console.log('Sample AI Enrichment:')
    console.log(`  Job: ${sample.title}`)
    console.log(`  OneLiner: ${sample.aiOneLiner?.slice(0, 100)}...`)
    console.log(`  Snippet: ${sample.aiSnippet?.slice(0, 100)}...`)
    if (sample.aiSummaryJson) {
      console.log(`  Summary: ${JSON.stringify(sample.aiSummaryJson).slice(0, 100)}...\n`)
    }
  } else {
    console.log('⚠️  No AI-enriched jobs found. AI enrichment may not be running.\n')
  }

  // 2. SALARY DATA AUDIT
  console.log('💰 SALARY DATA QUALITY')
  console.log('=======================')
  
  const withSalary = recentJobs.filter(j => j.minAnnual && j.maxAnnual)
  const salaryPercent = ((withSalary.length / recentJobs.length) * 100).toFixed(1)
  
  console.log(`With Salary: ${withSalary.length}/${recentJobs.length} (${salaryPercent}%)`)
  console.log(`Salary Validated: ${recentJobs.filter(j => j.salaryValidated).length}`)
  console.log(`Salary Confidence > 0: ${recentJobs.filter(j => j.salaryConfidence && j.salaryConfidence > 0).length}`)
  
  // Currency breakdown
  const currencyBreakdown: Record<string, number> = {}
  withSalary.forEach(j => {
    const curr = j.currency || 'NULL'
    currencyBreakdown[curr] = (currencyBreakdown[curr] || 0) + 1
  })
  
  console.log('\nCurrency Breakdown:')
  Object.entries(currencyBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([curr, count]) => {
      console.log(`  ${curr}: ${count}`)
    })

  // Salary ranges
  if (withSalary.length > 0) {
    const salaryRanges = {
      '100k-150k': withSalary.filter(j => j.minAnnual! >= 100000n && j.minAnnual! < 150000n).length,
      '150k-200k': withSalary.filter(j => j.minAnnual! >= 150000n && j.minAnnual! < 200000n).length,
      '200k-300k': withSalary.filter(j => j.minAnnual! >= 200000n && j.minAnnual! < 300000n).length,
      '300k+': withSalary.filter(j => j.minAnnual! >= 300000n).length,
    }
    
    console.log('\nSalary Ranges (minAnnual):')
    Object.entries(salaryRanges).forEach(([range, count]) => {
      console.log(`  ${range}: ${count}`)
    })
  }
  console.log()

  // 3. DESCRIPTION DATA AUDIT
  console.log('📝 DESCRIPTION QUALITY')
  console.log('=======================')
  
  const withDescHtml = recentJobs.filter(j => j.descriptionHtml && j.descriptionHtml.length > 100)
  
  console.log(`With HTML Description: ${withDescHtml.length}/${recentJobs.length}`)
  
  if (withDescHtml.length > 0) {
    const avgDescLength = withDescHtml.reduce((sum, j) => sum + (j.descriptionHtml?.length || 0), 0) / withDescHtml.length
    console.log(`Average Description Length: ${Math.round(avgDescLength)} chars`)
    
    const thinDescriptions = withDescHtml.filter(j => j.descriptionHtml!.length < 500)
    console.log(`Thin Descriptions (<500 chars): ${thinDescriptions.length}`)
  }
  console.log()

  // 4. LOCATION DATA AUDIT
  console.log('📍 LOCATION DATA QUALITY')
  console.log('=========================')
  
  const withLocation = recentJobs.filter(j => j.locationRaw)
  const withPrimaryLocation = recentJobs.filter(j => j.primaryLocation)
  const withLocationsJson = recentJobs.filter(j => j.locationsJson)
  
  console.log(`With locationRaw: ${withLocation.length}/${recentJobs.length}`)
  console.log(`With primaryLocation: ${withPrimaryLocation.length}/${recentJobs.length}`)
  console.log(`With locationsJson: ${withLocationsJson.length}/${recentJobs.length}\n`)

  // 5. COMPANY DATA AUDIT
  console.log('🏢 COMPANY DATA QUALITY')
  console.log('========================')
  
  const withCompanyId = recentJobs.filter(j => j.companyId)
  const withCompanyName = recentJobs.filter(j => j.companyRef?.name || j.company)
  const withCompanyLogo = recentJobs.filter(j => j.companyRef?.logoUrl || j.companyLogo)
  const withCompanyWebsite = recentJobs.filter(j => j.companyRef?.website)
  
  console.log(`With Company ID: ${withCompanyId.length}/${recentJobs.length}`)
  console.log(`With Company Name: ${withCompanyName.length}/${recentJobs.length}`)
  console.log(`With Company Logo: ${withCompanyLogo.length}/${recentJobs.length}`)
  console.log(`With Company Website: ${withCompanyWebsite.length}/${recentJobs.length}\n`)

  // 6. SOURCE BREAKDOWN
  console.log('📡 SOURCE BREAKDOWN')
  console.log('====================')
  
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
      console.log(`  ${source}: ${count} (${percent}%)`)
    })

  console.log()

  // 7. DATA COMPLETENESS SCORE
  console.log('⭐ DATA COMPLETENESS SCORE')
  console.log('===========================')
  
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
  
  console.log(`Average Completeness: ${avgScore.toFixed(1)}/10 (${avgPercent}%)`)
  
  const excellent = scores.filter(s => s >= 9).length
  const good = scores.filter(s => s >= 7 && s < 9).length
  const fair = scores.filter(s => s >= 5 && s < 7).length
  const poor = scores.filter(s => s < 5).length
  
  console.log(`\nQuality Distribution:`)
  console.log(`  Excellent (9-10): ${excellent}`)
  console.log(`  Good (7-8): ${good}`)
  console.log(`  Fair (5-6): ${fair}`)
  console.log(`  Poor (<5): ${poor}`)

  await prisma.$disconnect()
}

main().catch(console.error)
