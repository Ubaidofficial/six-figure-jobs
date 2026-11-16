// scripts/exportCorrectionLabels.ts
//
// Visitors' job reports as candidate labels for a gold set: each report with the job as it is stored NOW, the quote-backed
// evidence held for it (JobEvidence), and an empty `verdict` for a person to fill in. A report is a claim, not ground truth (see
// lib/history/correctionLabels.ts): review it before it measures any extractor. Also prints which sources draw the most
// reports per 1,000 live jobs, which is where to look first.
//
// Read-only: SELECTs only, nothing is written to the database.
//
//   npx tsx scripts/exportCorrectionLabels.ts                       # tallies only
//   npx tsx scripts/exportCorrectionLabels.ts --since=2026-10-01 --out=labels.json
import { writeFileSync } from 'node:fs'
import { format as __format } from 'node:util'

import { JOB_REPORT_TYPES, parseJobReport, type CorrectionCandidate } from '../lib/history/correctionLabels'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

async function main() {
  const since = arg('since') ? new Date(arg('since') as string) : new Date(Date.now() - 180 * 86_400_000)
  if (Number.isNaN(since.getTime())) throw new Error('--since must be a date such as 2026-10-01')
  const rows = await prisma.feedback.findMany({
    where: { type: { in: JOB_REPORT_TYPES }, createdAt: { gte: since } },
    select: { id: true, type: true, message: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })
  const candidates = rows.map(parseJobReport).filter((c): c is CorrectionCandidate => c !== null)
  const ids = [...new Set(candidates.map((c) => c.jobId))]

  const jobs = ids.length
    ? await prisma.job.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, title: true, company: true, source: true, url: true, applyUrl: true, isExpired: true, remoteMode: true, benefitsJson: true,
          salaryRaw: true, salarySource: true, salaryConfidence: true, minAnnual: true, maxAnnual: true, currency: true,
        },
      })
    : []
  const evidence = ids.length ? await prisma.jobEvidence.findMany({ where: { jobId: { in: ids } } }) : []
  const jobById = new Map(jobs.map((j) => [j.id, j]))

  const labels = candidates.map((c) => {
    const job = jobById.get(c.jobId)
    return {
      feedbackId: c.feedbackId,
      reportedAt: c.reportedAt,
      reason: c.reason,
      claim: c.claim,
      details: c.details,
      jobId: c.jobId,
      jobStillStored: Boolean(job),
      // The job as stored now, not as it was when the visitor looked.
      job: job ? { ...job, minAnnual: job.minAnnual?.toString() ?? null, maxAnnual: job.maxAnnual?.toString() ?? null } : null,
      evidence: evidence.filter((e) => e.jobId === c.jobId).map((e) => ({ field: e.field, value: e.value, quote: e.quote, extractor: e.extractor, version: e.extractorVersion })),
      verdict: null as null | 'visitor_right' | 'visitor_wrong' | 'unclear',
    }
  })

  __slog(`Job reports since ${since.toISOString().slice(0, 10)}: ${rows.length} read, ${candidates.length} name a job, ${labels.filter((l) => l.jobStillStored).length} of those jobs are still stored`)
  const byReason = new Map<string, number>()
  const bySource = new Map<string, number>()
  for (const l of labels) {
    byReason.set(l.reason, (byReason.get(l.reason) ?? 0) + 1)
    if (l.job) bySource.set(l.job.source, (bySource.get(l.job.source) ?? 0) + 1)
  }
  __slog('By reason:')
  for (const [k, v] of [...byReason].sort((a, b) => b[1] - a[1])) __slog(`  ${k.padEnd(14)} ${v}`)
  if (bySource.size) {
    const live = await prisma.job.groupBy({ by: ['source'], where: { isExpired: false }, _count: { _all: true } })
    const liveBy = new Map(live.map((g) => [g.source, g._count._all]))
    __slog('By source (reports, live jobs, reports per 1,000 live jobs):')
    for (const [src, n] of [...bySource].sort((a, b) => b[1] - a[1])) {
      const l = liveBy.get(src) ?? 0
      __slog(`  ${src.padEnd(24)} ${String(n).padStart(4)}  ${String(l).padStart(6)}  ${l ? ((1000 * n) / l).toFixed(1) : '-'}`)
    }
  }
  if (arg('out')) {
    writeFileSync(arg('out') as string, JSON.stringify(labels, null, 1))
    __slog(`Wrote ${labels.length} candidate labels to ${arg('out')} (verdict is empty: a person fills it in).`)
  }
}

main()
  .catch((e) => {
    __slog('FAILED:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
