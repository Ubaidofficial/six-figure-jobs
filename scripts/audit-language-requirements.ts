// scripts/audit-language-requirements.ts
//
// Read-only. How many live jobs REQUIRE a language other than English (lib/jobs/languageRequirement.ts), by language,
// with example sentences, so the owner can judge the heuristic on real postings before anything (a filter, a badge)
// is built on it. Writes nothing.
//
// Usage: npx tsx scripts/audit-language-requirements.ts [--limit=20000] [--examples=3]
import { format as __format } from 'node:util'

import { findLanguageRequirements } from '../lib/jobs/languageRequirement'
import { prisma } from '../lib/prisma'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const arg = (name: string, fallback: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)) || fallback
const limit = arg('limit', 20000)
const examples = arg('examples', 3)

async function main() {
  const byLanguage = new Map<string, { jobs: number; samples: string[] }>()
  let looked = 0
  let withRequirement = 0
  let cursor: string | undefined

  while (looked < limit) {
    const jobs = await prisma.job.findMany({
      where: { isExpired: false, descriptionHtml: { not: null } },
      select: { id: true, title: true, source: true, descriptionHtml: true },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (!jobs.length) break
    cursor = jobs[jobs.length - 1].id
    for (const job of jobs) {
      looked++
      const found = findLanguageRequirements(job)
      if (found.length) withRequirement++
      for (const r of found) {
        const entry = byLanguage.get(r.language) ?? { jobs: 0, samples: [] }
        entry.jobs++
        if (entry.samples.length < examples) entry.samples.push(`${job.source} | ${job.title.slice(0, 50)} | "${r.sentence.slice(0, 140)}"`)
        byLanguage.set(r.language, entry)
      }
    }
  }

  __slog(`looked at ${looked} live jobs; ${withRequirement} require a language other than English`)
  for (const [language, { jobs, samples }] of [...byLanguage].sort((a, b) => b[1].jobs - a[1].jobs)) {
    __slog(`\n${language}: ${jobs}`)
    for (const s of samples) __slog(`  ${s}`)
  }
}

main()
  .catch((err) => {
    process.stderr.write(String(err?.stack ?? err) + '\n')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
