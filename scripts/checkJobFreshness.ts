import { appendFile } from 'node:fs/promises'
import { prisma } from '../lib/prisma'
import { MAX_INDEXABLE_JOB_AGE_DAYS, buildFreshJobWhere } from '../lib/jobs/freshness'
import { buildGlobalExclusionsWhere, buildHighSalaryEligibilityWhere } from '../lib/jobs/queryJobs'
import {
  buildIndexableJobStructureWhere,
  evaluateJobIndexability,
} from '../lib/jobs/qualityGate'

const MAX_ACTIVE_LAST_SEEN_AGE_HOURS = Math.max(
  1,
  Number(process.env.MAX_ACTIVE_LAST_SEEN_AGE_HOURS || '72'),
)
const MIN_FRESH_INDEXABLE_JOBS = Math.max(
  0,
  Number(process.env.MIN_FRESH_INDEXABLE_JOBS || '1'),
)
const INDEXABILITY_DIAGNOSTIC_SAMPLE_SIZE = Math.max(
  1,
  Number(process.env.INDEXABILITY_DIAGNOSTIC_SAMPLE_SIZE || '250'),
)
const INDEXABILITY_DIAGNOSTIC_EXAMPLES_PER_REASON = Math.max(
  1,
  Number(process.env.INDEXABILITY_DIAGNOSTIC_EXAMPLES_PER_REASON || '3'),
)

type DiagnosticRow = {
  id: string
  title: string | null
  company: string | null
  roleSlug: string | null
  companyId: string | null
  locationRaw: string | null
  citySlug: string | null
  countryCode: string | null
  remote: boolean | null
  remoteMode: string | null
  descriptionHtml: string | null
  aiSnippet: string | null
  aiOneLiner: string | null
  salaryValidated: boolean | null
  salaryConfidence: number | null
  minAnnual: bigint | null
  maxAnnual: bigint | null
  currency: string | null
  isExpired: boolean
  lastSeenAt: Date | null
  postedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type DiagnosticReasonSummary = {
  reason: string
  count: number
  examples: string[]
}

type IndexabilityDiagnostics = {
  activeAfterGlobalExclusions: number
  highSalaryEligibleJobs: number
  freshHighSalaryEligibleJobs: number
  structuralEligibleJobs: number
  diagnosticSampleSize: number
  reasonSummaries: DiagnosticReasonSummary[]
}

function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60)
}

function pct(n: number, d: number): string {
  return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0.0%'
}

async function collectIndexabilityDiagnostics(
  eligibleWhere: Record<string, unknown>,
  freshEligibleWhere: Record<string, unknown>,
): Promise<IndexabilityDiagnostics> {
  const activeAfterExclusionsWhere = {
    isExpired: false,
    AND: [buildGlobalExclusionsWhere()],
  } as const

  const structuralEligibleWhere = {
    ...eligibleWhere,
    AND: [
      ...(Array.isArray((eligibleWhere as any).AND) ? (eligibleWhere as any).AND : []),
      buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS),
      buildIndexableJobStructureWhere(),
    ],
  } as const

  const [activeAfterExclusions, highSalaryEligibleJobs, structuralEligibleJobs, sampleRows] =
    await Promise.all([
      prisma.job.count({ where: activeAfterExclusionsWhere }),
      prisma.job.count({ where: eligibleWhere as any }),
      prisma.job.count({ where: structuralEligibleWhere as any }),
      prisma.job.findMany({
        where: activeAfterExclusionsWhere,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: INDEXABILITY_DIAGNOSTIC_SAMPLE_SIZE,
        select: {
          id: true,
          title: true,
          company: true,
          roleSlug: true,
          companyId: true,
          locationRaw: true,
          citySlug: true,
          countryCode: true,
          remote: true,
          remoteMode: true,
          descriptionHtml: true,
          aiSnippet: true,
          aiOneLiner: true,
          salaryValidated: true,
          salaryConfidence: true,
          minAnnual: true,
          maxAnnual: true,
          currency: true,
          isExpired: true,
          lastSeenAt: true,
          postedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }) as Promise<DiagnosticRow[]>,
    ])

  const reasonCounts = new Map<string, number>()
  const reasonExamples = new Map<string, string[]>()

  for (const row of sampleRows) {
    const result = evaluateJobIndexability(row)
    reasonCounts.set(result.reason, (reasonCounts.get(result.reason) ?? 0) + 1)

    const examples = reasonExamples.get(result.reason) ?? []
    if (examples.length < INDEXABILITY_DIAGNOSTIC_EXAMPLES_PER_REASON) {
      examples.push(
        `${row.id} :: ${row.title ?? 'untitled'} @ ${row.company ?? 'unknown-company'}`,
      )
      reasonExamples.set(result.reason, examples)
    }
  }

  const orderedReasons = Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1])

  return {
    activeAfterGlobalExclusions: activeAfterExclusions,
    highSalaryEligibleJobs,
    freshHighSalaryEligibleJobs: await prisma.job.count({ where: freshEligibleWhere as any }),
    structuralEligibleJobs,
    diagnosticSampleSize: sampleRows.length,
    reasonSummaries: orderedReasons.map(([reason, count]) => ({
      reason,
      count,
      examples: reasonExamples.get(reason) ?? [],
    })),
  }
}

function printIndexabilityDiagnostics(report: IndexabilityDiagnostics) {
  console.log('\n=== Indexability Diagnostics ===')
  console.log(`activeAfterGlobalExclusions=${report.activeAfterGlobalExclusions}`)
  console.log(`highSalaryEligibleJobs=${report.highSalaryEligibleJobs}`)
  console.log(`freshHighSalaryEligibleJobs=${report.freshHighSalaryEligibleJobs}`)
  console.log(`structuralEligibleJobs=${report.structuralEligibleJobs}`)
  console.log(`diagnosticSampleSize=${report.diagnosticSampleSize}`)

  if (report.reasonSummaries.length === 0) {
    console.log('sampleReasonCounts=none')
    return
  }

  console.log('sampleReasonCounts:')
  for (const { reason, count, examples } of report.reasonSummaries) {
    console.log(`- ${reason}: ${count} (${pct(count, report.diagnosticSampleSize)})`)
    for (const example of examples) {
      console.log(`  example: ${example}`)
    }
  }
}

function buildStepSummaryLines(params: {
  activeJobs: number
  freshIndexableJobs: number
  staleEligibleJobs: number
  newestLastSeenAt: Date | null
  newestAgeHours: number | null
  failureMessages: string[]
  diagnostics: IndexabilityDiagnostics | null
}) {
  const { activeJobs, freshIndexableJobs, staleEligibleJobs, newestLastSeenAt, newestAgeHours } = params
  const lines = [
    '## Job Freshness Guard',
    `- Status: ${params.failureMessages.length > 0 ? 'fail' : 'pass'}`,
    `- Active jobs: ${activeJobs}`,
    `- Fresh indexable jobs: ${freshIndexableJobs}`,
    `- Stale eligible jobs: ${staleEligibleJobs} (${pct(staleEligibleJobs, staleEligibleJobs + freshIndexableJobs)})`,
    `- Minimum fresh indexable jobs: ${MIN_FRESH_INDEXABLE_JOBS}`,
    `- Diagnostic sample size: ${INDEXABILITY_DIAGNOSTIC_SAMPLE_SIZE}`,
    `- Newest active lastSeenAt: ${newestLastSeenAt ? newestLastSeenAt.toISOString() : 'none'}`,
    `- Newest active lastSeen age hours: ${
      newestAgeHours === null ? 'n/a' : newestAgeHours.toFixed(1)
    }`,
    `- Max allowed age hours: ${MAX_ACTIVE_LAST_SEEN_AGE_HOURS}`,
  ]

  if (params.failureMessages.length > 0) {
    lines.push('')
    lines.push('### Failure Reasons')
    for (const message of params.failureMessages) {
      lines.push(`- ${message}`)
    }
  }

  if (params.diagnostics) {
    const diagnostics = params.diagnostics
    lines.push('')
    lines.push('### Indexability Diagnostics')
    lines.push(`- Active after global exclusions: ${diagnostics.activeAfterGlobalExclusions}`)
    lines.push(`- High-salary eligible jobs: ${diagnostics.highSalaryEligibleJobs}`)
    lines.push(`- Fresh high-salary eligible jobs: ${diagnostics.freshHighSalaryEligibleJobs}`)
    lines.push(`- Structural eligible jobs: ${diagnostics.structuralEligibleJobs}`)
    lines.push(`- Diagnostic sample size: ${diagnostics.diagnosticSampleSize}`)

    if (diagnostics.reasonSummaries.length > 0) {
      lines.push('')
      lines.push('### Sample Failure Reasons')
      for (const summary of diagnostics.reasonSummaries) {
        lines.push(
          `- ${summary.reason}: ${summary.count} (${pct(summary.count, diagnostics.diagnosticSampleSize)})`,
        )
        for (const example of summary.examples) {
          lines.push(`- Example: ${example}`)
        }
      }
    }
  }

  lines.push('')
  return lines
}

async function appendStepSummary(lines: string[]) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return
  await appendFile(summaryPath, `${lines.join('\n')}\n`)
}

async function main() {
  const eligibleWhere = {
    isExpired: false,
    AND: [buildGlobalExclusionsWhere(), buildHighSalaryEligibilityWhere()],
  } as const

  const freshEligibleWhere = {
    ...eligibleWhere,
    AND: [...eligibleWhere.AND, buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS)],
  } as const

  const [activeJobs, freshIndexableJobs, staleEligibleJobs, newestActive] = await Promise.all([
    prisma.job.count({ where: { isExpired: false } }),
    prisma.job.count({ where: freshEligibleWhere }),
    prisma.job.count({
      where: {
        ...eligibleWhere,
        AND: [
          ...eligibleWhere.AND,
          {
            NOT: buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS),
          },
        ],
      },
    }),
    prisma.job.aggregate({
      where: { isExpired: false },
      _max: { lastSeenAt: true },
    }),
  ])

  const newestLastSeenAt = newestActive._max.lastSeenAt

  console.log('=== Job Freshness Guard ===')
  console.log(`activeJobs=${activeJobs}`)
  console.log(`freshIndexableJobs=${freshIndexableJobs}`)
  console.log(`staleEligibleJobs=${staleEligibleJobs}`)
  console.log(`staleEligiblePct=${pct(staleEligibleJobs, staleEligibleJobs + freshIndexableJobs)}`)
  console.log(`minFreshIndexableJobs=${MIN_FRESH_INDEXABLE_JOBS}`)
  console.log(`indexabilityDiagnosticSampleSize=${INDEXABILITY_DIAGNOSTIC_SAMPLE_SIZE}`)

  let diagnostics: IndexabilityDiagnostics | null = null
  const failureMessages: string[] = []

  if (!newestLastSeenAt) {
    diagnostics = await collectIndexabilityDiagnostics(eligibleWhere, freshEligibleWhere)
    printIndexabilityDiagnostics(diagnostics)
    failureMessages.push('No active lastSeenAt timestamp found; scrape freshness cannot be verified')
    await appendStepSummary(
      buildStepSummaryLines({
        activeJobs,
        freshIndexableJobs,
        staleEligibleJobs,
        newestLastSeenAt: null,
        newestAgeHours: null,
        failureMessages,
        diagnostics,
      }),
    )
    throw new Error(failureMessages[0])
  }

  const newestAgeHours = hoursSince(newestLastSeenAt)
  console.log(`newestActiveLastSeenAt=${newestLastSeenAt.toISOString()}`)
  console.log(`newestActiveLastSeenAgeHours=${newestAgeHours.toFixed(1)}`)
  console.log(`maxAllowedAgeHours=${MAX_ACTIVE_LAST_SEEN_AGE_HOURS}`)

  const shouldPrintDiagnostics =
    freshIndexableJobs < MIN_FRESH_INDEXABLE_JOBS ||
    newestAgeHours > MAX_ACTIVE_LAST_SEEN_AGE_HOURS

  if (shouldPrintDiagnostics) {
    diagnostics = await collectIndexabilityDiagnostics(eligibleWhere, freshEligibleWhere)
    printIndexabilityDiagnostics(diagnostics)
  }

  if (freshIndexableJobs < MIN_FRESH_INDEXABLE_JOBS) {
    failureMessages.push(
      `Freshness guard failed: fresh indexable jobs ${freshIndexableJobs} < required minimum ${MIN_FRESH_INDEXABLE_JOBS}`,
    )
  }

  if (newestAgeHours > MAX_ACTIVE_LAST_SEEN_AGE_HOURS) {
    failureMessages.push(
      `Freshness guard failed: newest active job was last seen ${newestAgeHours.toFixed(1)}h ago`,
    )
  }

  await appendStepSummary(
    buildStepSummaryLines({
      activeJobs,
      freshIndexableJobs,
      staleEligibleJobs,
      newestLastSeenAt,
      newestAgeHours,
      failureMessages,
      diagnostics,
    }),
  )

  if (failureMessages.length > 0) {
    throw new Error(failureMessages.join(' | '))
  }
}

main()
  .catch((error) => {
    console.error('[checkJobFreshness] error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
