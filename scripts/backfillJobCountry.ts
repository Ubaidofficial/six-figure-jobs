// scripts/backfillJobCountry.ts
//
// Live jobs with no stored country get the one today's import rules give them (processLocation in lib/ingest/index.ts),
// read from what is stored: the location text, the pay currency and the work mode. New and refreshed jobs already get it
// at import; this brings the rest in line (quality finding `missing_country`, 2026-11-25). Remote jobs still take a
// country only from their location text ("Remote - Texas"), never from a city or the pay currency. A DRY RUN unless
// --apply. Each write is guarded by "countryCode is still empty" and writes countryCode only.
//
// SEO: a country changes the job's JobPosting (lib/seo/jobJsonLd.ts): `addressCountry` for on-site and hybrid jobs,
// `applicantLocationRequirements` for remote ones, and the job joins its country's pages and filters. The report shows
// how many JobPostings change and examples of each, to read before --apply.
//
//   npx tsx scripts/backfillJobCountry.ts [--limit=20000] [--apply]
import { appendFileSync } from 'node:fs'

import { parseLimit } from '../lib/ai/freeEnrichWrite'
import { processLocation } from '../lib/ingest/index'
import { buildJobJsonLd } from '../lib/seo/jobJsonLd'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const apply = process.argv.includes('--apply')

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const limit = parseLimit(arg('limit'), 20000, 50000)
  const lines: string[] = [`## Live jobs: country from today's location rules (${apply ? 'APPLY' : 'dry run, nothing written'})`, '']
  const out = (s = '') => lines.push(s)
  try {
    const jobs = await prisma.job.findMany({
      where: { isExpired: false, countryCode: null },
      include: { companyRef: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    const toWrite: Array<{ id: string; country: string }> = []
    const byCountry = new Map<string, number>()
    const byText = new Map<string, { country: string; jobs: number }>()
    const samples: Record<'remote' | 'other', string[]> = { remote: [], other: [] }
    let jsonLdChanged = 0
    for (const job of jobs) {
      const mode = job.remoteMode === 'remote' || job.remoteMode === 'hybrid' || job.remoteMode === 'onsite' ? job.remoteMode : null
      const country = processLocation({
        locationText: job.locationRaw,
        salaryCurrency: job.currency ?? job.salaryCurrency,
        isRemote: job.remote,
        workplaceType: mode,
      } as Parameters<typeof processLocation>[0]).countryCode
      if (!country) continue
      toWrite.push({ id: job.id, country })
      byCountry.set(country, (byCountry.get(country) ?? 0) + 1)
      const text = String(job.locationRaw ?? '')
      const e = byText.get(text) ?? { country, jobs: 0 }
      e.jobs++
      byText.set(text, e)
      const before = buildJobJsonLd(job)
      const after = buildJobJsonLd({ ...job, countryCode: country })
      if (JSON.stringify(before) === JSON.stringify(after)) continue
      jsonLdChanged++
      const kind = mode === 'remote' || job.remote ? 'remote' : 'other'
      if (samples[kind].length < 8) {
        const field = kind === 'remote' ? 'applicantLocationRequirements' : 'jobLocation'
        samples[kind].push(`  "${text}" -> ${country}: ${field} ${JSON.stringify((before as Record<string, unknown>)[field] ?? null)} => ${JSON.stringify((after as Record<string, unknown>)[field] ?? null)}`)
      }
    }
    out(`Live jobs with no country: ${jobs.length} (limit ${limit}).`)
    out(`- get a country from today's rules: **${toWrite.length}** (${[...byCountry.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', ') || '-'})`)
    out(`- of those, JobPosting markup changes for ${jsonLdChanged}`)
    out(`- still no country: ${jobs.length - toWrite.length}`)
    out()
    out('Most common location texts that get a country:')
    for (const [text, e] of [...byText.entries()].sort((a, b) => b[1].jobs - a[1].jobs).slice(0, 30)) out(`  ${e.jobs} x "${text}" -> ${e.country}`)
    for (const kind of ['other', 'remote'] as const) {
      if (!samples[kind].length) continue
      out()
      out(kind === 'remote' ? 'Remote jobs whose JobPosting changes (examples):' : 'On-site, hybrid or unknown jobs whose JobPosting changes (examples):')
      for (const s of samples[kind]) out(s)
    }
    if (apply) {
      let written = 0
      for (const w of toWrite) written += (await prisma.job.updateMany({ where: { id: w.id, countryCode: null }, data: { countryCode: w.country } })).count
      out()
      out(`Wrote ${written}.`)
    }
  } finally {
    await prisma.$disconnect()
  }
  const report = lines.join('\n')
  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
