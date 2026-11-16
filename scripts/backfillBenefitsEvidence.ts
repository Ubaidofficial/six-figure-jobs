// scripts/backfillBenefitsEvidence.ts
//
// Fill an EMPTY `benefitsJson` from the time off and benefits a posting's own sentences state
// (lib/jobs/benefitsEvidence.ts). Same pattern as scripts/backfillRemoteEvidence.ts.
//
// Safe by default:
//  - a dry run unless --apply is passed;
//  - only jobs whose benefitsJson is empty (null, '' or '[]') are looked at, and jobs with an AI benefits list
//    (aiBenefits) are skipped; the write is conditional on the field still being empty, so freehire / ATS perks and an AI
//    list are never overridden;
//  - writes `benefitsJson` as a JSON array of label strings, and keeps each benefit's sentence in JobEvidence (lib/history/evidence.ts);
//  - `updatedAt` is kept as it was, so sitemap lastmod does not move for a data repair.
//
// It prints: jobs scanned, jobs with at least one benefit found, a count per category, and 25 random examples with the
// quote, so a human can judge precision before --apply is used.
//
// Usage:
//   npx tsx scripts/backfillBenefitsEvidence.ts                       # dry run
//   npx tsx scripts/backfillBenefitsEvidence.ts --limit=5000 --report=benefits-evidence.json
//   npx tsx scripts/backfillBenefitsEvidence.ts --apply --report=benefits-evidence.json
import { writeFileSync } from 'node:fs'
import { format as __format } from 'node:util'

import { readBenefitsEvidence, type BenefitCategory, type BenefitEvidence } from '../lib/jobs/benefitsEvidence'
import { benefitEvidenceRecords, saveEvidence } from '../lib/history/evidence'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const apply = process.argv.includes('--apply')
const limit = Number(arg('limit') ?? 0) || Infinity
const reportPath = arg('report')
const BATCH = 500
const EXAMPLES = 25

const EMPTY = [{ benefitsJson: null }, { benefitsJson: '' }, { benefitsJson: '[]' }]

type Row = { id: string; title: string; source: string; benefits: BenefitEvidence[]; written: boolean }

/** An AI benefits list in any of the shapes the job page reads (array, or { benefits | items | bullets }). */
function hasAiBenefits(raw: unknown): boolean {
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return raw.trim().length > 0
    }
  }
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    const items = o.benefits ?? o.items ?? o.bullets
    return Array.isArray(items) && items.length > 0
  }
  return false
}

async function main() {
  const counts = { scanned: 0, skippedAiList: 0, withBenefit: 0, applied: 0, evidenceSaved: 0 }
  const byCategory: Record<BenefitCategory, number> = { pto: 0, parental: 0, health: 0, k401: 0, pension: 0, equity: 0, learning: 0, fourDay: 0 }
  const sample: Row[] = [] // reservoir of EXAMPLES random hits
  const report: Row[] = []
  let cursor: string | undefined

  while (counts.scanned < limit) {
    const jobs = await prisma.job.findMany({
      where: { isExpired: false, descriptionHtml: { not: null }, OR: EMPTY },
      select: { id: true, title: true, source: true, descriptionHtml: true, aiBenefits: true, updatedAt: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (!jobs.length) break
    cursor = jobs[jobs.length - 1].id

    for (const job of jobs) {
      if (counts.scanned >= limit) break
      if (hasAiBenefits(job.aiBenefits)) {
        counts.skippedAiList++
        continue
      }
      counts.scanned++
      const benefits = readBenefitsEvidence(job.descriptionHtml)
      if (!benefits.length) continue
      counts.withBenefit++
      for (const b of benefits) byCategory[b.category]++

      let written = false
      if (apply) {
        const { count } = await prisma.job.updateMany({
          where: { id: job.id, OR: EMPTY },
          data: { benefitsJson: JSON.stringify(benefits.map((b) => b.label)), updatedAt: job.updatedAt },
        })
        written = count === 1
        counts.applied += count
        // Keep the sentences the labels were read from, only when the labels were written.
        if (written) counts.evidenceSaved += await saveEvidence(prisma, benefitEvidenceRecords(job.id, benefits))
      }
      const row: Row = { id: job.id, title: job.title, source: job.source, benefits, written }
      if (reportPath) report.push(row)
      if (sample.length < EXAMPLES) sample.push(row)
      else {
        const at = Math.floor(Math.random() * counts.withBenefit)
        if (at < EXAMPLES) sample[at] = row
      }
    }
  }

  __slog(`${apply ? 'APPLIED' : 'DRY RUN'}`)
  __slog(JSON.stringify({ ...counts, byCategory }))
  __slog(`${sample.length} random examples:`)
  for (const r of sample) {
    __slog(`  ${r.source} | ${r.title.slice(0, 60)}`)
    for (const b of r.benefits) __slog(`    [${b.label}] "${b.quote.slice(0, 160)}"`)
  }
  if (reportPath) {
    writeFileSync(reportPath, JSON.stringify({ apply, counts, byCategory, report }, null, 1))
    __slog(`report: ${reportPath}`)
  }
}

main()
  .catch((err) => {
    process.stderr.write(String(err?.stack ?? err) + '\n')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
