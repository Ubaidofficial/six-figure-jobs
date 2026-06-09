// scripts/repairPriorityAtsConfigs.ts
//
// Probes likely ATS endpoints for the broken priority-company brands and,
// for the ones that respond with a recognizable job-board payload, updates
// the Company row in the DB so the daily scrape will pick them up.
//
// Brands and their candidate endpoints come from the post-mortem on
// auditPriorityCompanies.ts:
//
//   - Netflix:    Lever — slug needs verification
//   - NVIDIA:     Workday — nvidia.wd5.myworkdayjobs.com
//   - OpenAI:     Greenhouse — boards.greenhouse.io/openai
//   - Salesforce: Workday — salesforce.wd12.myworkdayjobs.com
//
// Brands with NO public ATS (Amazon, Apple, Google, Meta, Microsoft,
// Shopify) are skipped — their careers sites are custom builds with no
// scrapable feed.
//
// Run via:
//   railway run --service six-figure-jobs npx tsx scripts/repairPriorityAtsConfigs.ts            # dry-run
//   railway run --service six-figure-jobs npx tsx scripts/repairPriorityAtsConfigs.ts --apply    # write changes

import { prisma } from '../lib/prisma'

const APPLY = process.argv.includes('--apply')

type Candidate = {
  slug: string
  brand: string
  atsProvider: 'lever' | 'greenhouse' | 'workday'
  atsUrl: string
  probeUrl: string
  // Substring the probe response must contain for us to consider this ATS
  // working. Keeps the script honest: only update the DB when the endpoint
  // actually returns job data.
  probeContains: string
}

const CANDIDATES: Candidate[] = [
  // Lever — public API returns a JSON array of postings per company slug.
  {
    slug: 'netflix',
    brand: 'Netflix',
    atsProvider: 'lever',
    atsUrl: 'https://jobs.lever.co/netflix',
    probeUrl: 'https://api.lever.co/v0/postings/netflix?mode=json',
    probeContains: '"id"',
  },
  // OpenAI — Greenhouse boards. The public JSON endpoint is
  // boards-api.greenhouse.io/v1/boards/<slug>/jobs.
  {
    slug: 'openai',
    brand: 'OpenAI',
    atsProvider: 'greenhouse',
    atsUrl: 'https://boards.greenhouse.io/openai',
    probeUrl: 'https://boards-api.greenhouse.io/v1/boards/openai/jobs',
    probeContains: '"jobs"',
  },
  // NVIDIA — Workday's job-search endpoint accepts an empty body and
  // returns a JSON payload with `jobPostings`.
  {
    slug: 'nvidia',
    brand: 'NVIDIA',
    atsProvider: 'workday',
    atsUrl: 'https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite',
    probeUrl:
      'https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs',
    probeContains: '"jobPostings"',
  },
  // Salesforce — Workday External_Career_Site.
  {
    slug: 'salesforce',
    brand: 'Salesforce',
    atsProvider: 'workday',
    atsUrl: 'https://salesforce.wd12.myworkdayjobs.com/External_Career_Site',
    probeUrl:
      'https://salesforce.wd12.myworkdayjobs.com/wday/cxs/salesforce/External_Career_Site/jobs',
    probeContains: '"jobPostings"',
  },
]

const SKIPPED = [
  { slug: 'amazon', brand: 'Amazon', reason: 'custom careers site, no public ATS feed' },
  { slug: 'apple', brand: 'Apple', reason: 'custom careers site (jobs.apple.com), no public ATS' },
  { slug: 'google', brand: 'Google', reason: 'custom careers site, no public ATS' },
  { slug: 'meta', brand: 'Meta', reason: 'custom careers site (metacareers.com), no public ATS' },
  { slug: 'microsoft', brand: 'Microsoft', reason: 'custom careers site, no public ATS' },
  { slug: 'shopify', brand: 'Shopify', reason: 'custom careers site (shopify.com/careers), no public ATS' },
]

async function probe(candidate: Candidate): Promise<{
  ok: boolean
  status: number | null
  payloadSnippet: string
  error?: string
}> {
  try {
    const isWorkday = candidate.atsProvider === 'workday'
    const res = await fetch(candidate.probeUrl, {
      method: isWorkday ? 'POST' : 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SixFigureJobs/1.0 (+job-board-scraper)',
        ...(isWorkday ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isWorkday
        ? JSON.stringify({ limit: 5, offset: 0, searchText: '', appliedFacets: {} })
        : null,
    })
    const text = await res.text()
    return {
      ok: res.status === 200 && text.includes(candidate.probeContains),
      status: res.status,
      payloadSnippet: text.slice(0, 160),
    }
  } catch (err) {
    return {
      ok: false,
      status: null,
      payloadSnippet: '',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function main() {
  console.log(`\n=== Priority ATS repair (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`)
  console.log('Probing candidates...\n')

  let updated = 0
  let failed = 0

  for (const candidate of CANDIDATES) {
    const result = await probe(candidate)
    const headline = `${candidate.brand.padEnd(12)} ${candidate.atsProvider.padEnd(11)} → ${
      result.ok ? 'OK' : 'FAIL'
    } (status=${result.status})`
    console.log(headline)
    if (!result.ok) {
      console.log(`  payload: ${result.payloadSnippet}`)
      if (result.error) console.log(`  error: ${result.error}`)
      failed++
      continue
    }

    if (APPLY) {
      const before = await prisma.company.findUnique({
        where: { slug: candidate.slug },
        select: { atsProvider: true, atsUrl: true, scrapeStatus: true },
      })
      if (!before) {
        console.log(`  skipped — Company row not found for slug=${candidate.slug}`)
        continue
      }
      await prisma.company.update({
        where: { slug: candidate.slug },
        data: {
          atsProvider: candidate.atsProvider,
          atsUrl: candidate.atsUrl,
          // Reset failure state so the daily scrape picks them up immediately
          // instead of waiting for the cooldown.
          scrapeStatus: null,
          scrapeError: null,
        },
      })
      console.log(`  applied → atsProvider=${candidate.atsProvider}, atsUrl=${candidate.atsUrl}`)
      updated++
    } else {
      console.log(
        `  would set → atsProvider=${candidate.atsProvider}, atsUrl=${candidate.atsUrl}`,
      )
    }
  }

  console.log('\n=== No-public-ATS brands (skipped) ===\n')
  for (const s of SKIPPED) {
    console.log(`  ${s.brand.padEnd(12)} ${s.reason}`)
  }

  console.log(
    `\n=== Summary: ${APPLY ? 'updated' : 'would update'} ${
      APPLY ? updated : CANDIDATES.length - failed
    }, failed ${failed}, skipped ${SKIPPED.length} ===\n`,
  )

  if (!APPLY) {
    console.log('Re-run with --apply to write changes.')
  } else {
    console.log('Next daily scrape (or manual trigger) will pick these up.')
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('repair failed:', err instanceof Error ? err.message : String(err))
  await prisma.$disconnect()
  process.exit(1)
})
