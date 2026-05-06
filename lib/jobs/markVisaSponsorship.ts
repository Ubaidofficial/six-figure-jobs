// lib/jobs/markVisaSponsorship.ts
// Scans job descriptions for H1B/visa sponsorship keywords and marks
// visaSponsorship = true on matching jobs.
//
// Run via: npx tsx scripts/markVisaSponsorship.ts
// Or call markVisaSponsorshipBatch() from the daily scrape pipeline.

import { prisma } from '../prisma'

const VISA_KEYWORDS = [
  // H1B explicit
  'h1b', 'h-1b', 'h1-b', 'h1 b visa',
  // General sponsorship phrases
  'visa sponsorship', 'sponsor visa', 'will sponsor', 'sponsoring visa',
  'sponsorship available', 'visa support', 'work visa',
  // OPT / CPT / work authorization
  'opt eligible', 'opt students', 'cpt eligible', 'stem opt',
  // Legal phrases that appear in sponsored job descriptions
  'immigration sponsorship', 'work authorization sponsored',
  'sponsor work authorization', 'sponsoring work authorization',
  // Explicit statements in JDs
  'we sponsor h', 'we will sponsor', 'sponsoring h-1b', 'sponsoring h1b',
  'supports visa', 'visa support provided',
]

// Known major H1B sponsors — jobs from these companies are automatically tagged
const KNOWN_H1B_SPONSORS = new Set([
  'google', 'meta', 'amazon', 'microsoft', 'apple', 'nvidia',
  'salesforce', 'oracle', 'ibm', 'intel', 'qualcomm', 'cisco',
  'deloitte', 'accenture', 'cognizant', 'infosys', 'wipro', 'tcs',
  'tata consultancy', 'capgemini', 'hcl', 'tech mahindra',
  'jpmorgan', 'jp morgan', 'goldman sachs', 'morgan stanley',
  'stripe', 'airbnb', 'uber', 'lyft', 'twitter', 'x corp',
  'netflix', 'linkedin', 'adobe', 'intuit', 'workday', 'servicenow',
  'databricks', 'snowflake', 'palantir', 'two sigma', 'jane street',
  'de shaw', 'd.e. shaw', 'citadel', 'hudson river trading',
  'openai', 'anthropic', 'deepmind', 'scale ai',
])

function descriptionContainsVisaKeyword(html: string | null): boolean {
  const content = (html ?? '').toLowerCase()
  return VISA_KEYWORDS.some((kw) => content.includes(kw))
}

function companyIsKnownSponsor(companyName: string | null): boolean {
  if (!companyName) return false
  const lower = companyName.toLowerCase()
  return [...KNOWN_H1B_SPONSORS].some((sponsor) => lower.includes(sponsor))
}

export async function markVisaSponsorshipBatch(options?: {
  batchSize?: number
  dryRun?: boolean
}): Promise<{ marked: number; checked: number }> {
  const batchSize = options?.batchSize ?? 500
  const dryRun = options?.dryRun ?? false

  let cursor: string | undefined
  let totalChecked = 0
  let totalMarked = 0

  console.log(`[markVisaSponsorship] Starting batch scan (batchSize=${batchSize}, dryRun=${dryRun})`)

  while (true) {
    const jobs = await prisma.job.findMany({
      where: {
        visaSponsorship: false,
        isExpired: false,
      },
      select: {
        id: true,
        company: true,
        descriptionHtml: true,
      },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    })

    if (jobs.length === 0) break

    cursor = jobs[jobs.length - 1].id
    totalChecked += jobs.length

    const idsToMark = jobs
      .filter(
        (j) =>
          descriptionContainsVisaKeyword(j.descriptionHtml) ||
          companyIsKnownSponsor(j.company),
      )
      .map((j) => j.id)

    if (idsToMark.length > 0) {
      totalMarked += idsToMark.length
      if (!dryRun) {
        await prisma.job.updateMany({
          where: { id: { in: idsToMark } },
          data: { visaSponsorship: true },
        })
      }
      console.log(`[markVisaSponsorship] Marked ${idsToMark.length} jobs in this batch (total: ${totalMarked})`)
    }
  }

  console.log(`[markVisaSponsorship] Done. Checked ${totalChecked}, marked ${totalMarked}`)
  return { marked: totalMarked, checked: totalChecked }
}

// Also mark jobs from specific source boards as visa sponsorship
export async function markVisaSponsorshipBySource(
  sources: string[],
  dryRun = false,
): Promise<number> {
  if (sources.length === 0) return 0

  const result = await prisma.job.updateMany({
    where: {
      source: { in: sources },
      visaSponsorship: false,
    },
    data: { visaSponsorship: true },
  })

  console.log(`[markVisaSponsorship] Marked ${result.count} jobs from sources: ${sources.join(', ')}`)
  return result.count
}
