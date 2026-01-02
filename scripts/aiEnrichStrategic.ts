/**
 * Strategic AI Enrichment - Top jobs per category only
 * Enriches the best jobs from each role/category to maximize value
 */
import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { enrichJobWithAI } from '../lib/ai/openaiEnricher'
import { buildSnippetFromJob } from '../lib/jobs/snippet'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

const TOP_N_PER_CATEGORY = Number(process.env.TOP_N || '30')
const MAX_TOTAL_JOBS = Number(process.env.MAX_TOTAL || '500')

// Key role categories to prioritize
const KEY_ROLES = [
  'software-engineer',
  'senior-software-engineer',
  'staff-engineer',
  'principal-engineer',
  'engineering-manager',
  'director-engineering',
  'product-manager',
  'senior-product-manager',
  'data-scientist',
  'machine-learning-engineer',
  'devops-engineer',
  'security-engineer',
  'frontend-engineer',
  'backend-engineer',
  'full-stack-engineer',
]

async function main() {
  __slog('🎯 Strategic AI Enrichment')
  __slog('===========================')
  __slog(`Top N per category: ${TOP_N_PER_CATEGORY}`)
  __slog(`Max total jobs: ${MAX_TOTAL_JOBS}`)
  __slog(`Key roles: ${KEY_ROLES.length}\n`)

  const jobsToEnrich: any[] = []

  // Get top jobs from each key role
  for (const roleSlug of KEY_ROLES) {
    const topJobs = await prisma.job.findMany({
      where: {
        roleSlug,
        isExpired: false,
        aiOneLiner: null, // Not yet enriched
        salaryValidated: true,
        minAnnual: { gte: 100000n }
      },
      orderBy: [
        { minAnnual: 'desc' }, // Highest paying first
        { createdAt: 'desc' }  // Most recent first
      ],
      take: TOP_N_PER_CATEGORY,
      select: {
        id: true,
        title: true,
        roleSlug: true,
        minAnnual: true,
        descriptionHtml: true,
        locationRaw: true,
        primaryLocation: true
      }
    })

    if (topJobs.length > 0) {
      __slog(`  ${roleSlug}: Found ${topJobs.length} top jobs`)
      jobsToEnrich.push(...topJobs)
    }
  }

  // Also get top jobs without roleSlug (newly scraped)
  const uncategorized = await prisma.job.findMany({
    where: {
      roleSlug: null,
      isExpired: false,
      aiOneLiner: null,
      salaryValidated: true,
      minAnnual: { gte: 100000n }
    },
    orderBy: [
      { minAnnual: 'desc' },
      { createdAt: 'desc' }
    ],
    take: TOP_N_PER_CATEGORY,
    select: {
      id: true,
      title: true,
      roleSlug: true,
      minAnnual: true,
      descriptionHtml: true,
      locationRaw: true,
      primaryLocation: true
    }
  })

  if (uncategorized.length > 0) {
    __slog(`  uncategorized: Found ${uncategorized.length} jobs\n`)
    jobsToEnrich.push(...uncategorized)
  }

  // Deduplicate
  const uniqueJobs = Array.from(
    new Map(jobsToEnrich.map(j => [j.id, j])).values()
  )

  // Limit to MAX_TOTAL_JOBS
  const jobsToProcess = uniqueJobs.slice(0, MAX_TOTAL_JOBS)

  __slog(`\n📊 Total unique jobs to enrich: ${jobsToProcess.length}`)
  __slog(`   Average salary: $${Math.round(
    Number(jobsToProcess.reduce((sum, j) => sum + (j.minAnnual || 0n), 0n)) / jobsToProcess.length / 1000
  )}k\n`)

  let processed = 0
  let errors = 0

  for (const job of jobsToProcess) {
    try {
      const roleSnippet = buildSnippetFromJob({
        title: job.title || '',
        descriptionHtml: job.descriptionHtml ?? undefined,
      })

      const locationHint = job.locationRaw || 
        (job.primaryLocation && typeof job.primaryLocation === 'object' && 'locationRaw' in job.primaryLocation
          ? String((job.primaryLocation as any).locationRaw || '')
          : '')

      const { out, tokensIn, tokensOut } = await enrichJobWithAI({
        title: job.title || '',
        roleSnippet,
        locationHint: locationHint || undefined,
        maxOutputTokens: 220,
      })

      await prisma.job.update({
        where: { id: job.id },
        data: {
          aiOneLiner: out.oneLiner.trim(),
          aiSnippet: out.snippet.trim(),
          aiSummaryJson: { bullets: out.bullets },
          aiEnrichedAt: new Date(),
        },
      })

      processed++
      if (processed % 10 === 0) {
        __slog(`   ✓ Processed ${processed}/${jobsToProcess.length}`)
      }

    } catch (err: any) {
      errors++
      __serr(`   ✗ Failed: ${job.id} - ${err.message}`)
    }
  }

  __slog(`\n✅ Strategic enrichment complete`)
  __slog(`   Processed: ${processed}`)
  __slog(`   Errors: ${errors}`)
  __slog(`   Success rate: ${((processed / jobsToProcess.length) * 100).toFixed(1)}%`)

  await prisma.$disconnect()
}

main().catch(console.error)
