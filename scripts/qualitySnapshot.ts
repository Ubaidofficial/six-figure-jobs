// scripts/qualitySnapshot.ts
//
// The daily quality snapshot (lib/quality/snapshot.ts; docs/QUALITY_AGENTS_PLAN.md): every quality check's count over the
// listed jobs, compared with the last stored snapshot, printed for the run log and the job summary (the quality agents
// read it there). Read-only unless --apply is passed, which stores the snapshot and updates the findings list. With
// GITHUB_TOKEN and GITHUB_REPOSITORY set (a workflow run), pull requests that name a finding ("Quality-Finding: <key>")
// are linked to it.
//
//   npx tsx scripts/qualitySnapshot.ts            # prints the report, stores nothing
//   npx tsx scripts/qualitySnapshot.ts --apply
import { appendFileSync } from 'node:fs'

import { prisma } from '../lib/prisma'
import { collectSnapshot, fetchPrs, formatReport, saveSnapshot, type Snapshot } from '../lib/quality/snapshot'

const apply = process.argv.includes('--apply')

async function main() {
  const prs = await fetchPrs(process.env.GITHUB_REPOSITORY, process.env.GITHUB_TOKEN)
  const [last] = await prisma.qualitySnapshot.findMany({ orderBy: { capturedAt: 'desc' }, take: 1 })
  const snap = await collectSnapshot(prisma, prs)
  const report = formatReport(snap, last ? ({ checks: last.checks } as unknown as Pick<Snapshot, 'checks'>) : null)
  process.stdout.write(report + '\n')
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n')
  if (apply) {
    const { open, fixed } = await saveSnapshot(prisma, snap, prs)
    process.stdout.write(`\nStored. Findings: ${open} open or with a PR, ${fixed} fixed.\n`)
  } else {
    process.stdout.write('\nNot stored (dry run). Pass --apply to store it and update the findings.\n')
  }
  // The findings list as stored, for the quality agents (which read this log): they skip "pr" and "wontfix".
  const findings = await prisma.qualityFinding.findMany({ orderBy: { key: 'asc' } })
  process.stdout.write(
    ['', 'Findings (key | status | count | pull request | note):', ...findings.map((f) => `- ${f.key} | ${f.status} | ${f.count} | ${f.prUrl ?? '-'} | ${f.note ?? '-'}`)].join('\n') + '\n',
  )
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
