// scripts/backfill-remote-country.ts
//
// Live remote jobs with no stored country whose location text names exactly one country ("Remote (US)", "Remote - Canada") get
// that country, read by the same single-place reader the job pages use (lib/location/jobLocation.ts countryFromText: it gives
// nothing when the text names two countries or none, and never reads "CA" or "DE" as a country). A DRY RUN unless --apply.
//
//   npx tsx scripts/backfill-remote-country.ts [--limit=3000] [--apply]
//
// SEO guard: for every candidate the job's WHOLE JobPosting JSON-LD is built twice, with and without the country
// (lib/seo/jobJsonLd.ts). Only a job whose markup is IDENTICAL either way is written, so structured data does not change; a job
// whose markup would change is listed in the report and left alone for a person to decide. What does change is the listing side:
// the job now appears under its country's remote pages (lib/jobs/remoteRegions.ts filters on countryCode).
// Each write is guarded by "countryCode is still empty".
import { appendFileSync } from 'node:fs'

import { buildJobJsonLd } from '../lib/seo/jobJsonLd'
import { countryFromText, isPlaceholderLocation } from '../lib/location/jobLocation'
import { parseLimit } from '../lib/ai/freeEnrichWrite'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const apply = process.argv.includes('--apply')

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const limit = parseLimit(arg('limit'), 3000, 20000)
  const lines: string[] = [`## Remote jobs: country from the location text (${apply ? 'APPLY' : 'dry run, nothing written'})`, '']
  const out = (s = '') => lines.push(s)
  try {
    const jobs = await prisma.job.findMany({
      where: { isExpired: false, countryCode: null, locationRaw: { not: null }, OR: [{ remote: true }, { remoteMode: 'remote' }] },
      include: { companyRef: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    let none = 0
    let identical = 0
    let changed = 0
    const byText = new Map<string, { country: string; jobs: number }>()
    const changedSamples: string[] = []
    const toWrite: Array<{ id: string; country: string }> = []
    for (const job of jobs) {
      const text = String(job.locationRaw ?? '')
      const country = isPlaceholderLocation(text) ? null : countryFromText(text)
      if (!country) {
        none++
        continue
      }
      const before = JSON.stringify(buildJobJsonLd(job))
      const after = JSON.stringify(buildJobJsonLd({ ...job, countryCode: country }))
      if (before !== after) {
        changed++
        if (changedSamples.length < 15) {
          const b = buildJobJsonLd(job).applicantLocationRequirements
          const a = buildJobJsonLd({ ...job, countryCode: country }).applicantLocationRequirements
          changedSamples.push(`  "${text}" -> ${country}: requirements ${JSON.stringify(b)} => ${JSON.stringify(a)}`)
        }
        continue
      }
      identical++
      toWrite.push({ id: job.id, country })
      const e = byText.get(text) ?? { country, jobs: 0 }
      e.jobs++
      byText.set(text, e)
    }
    out(`Live remote jobs with no country and a location text read: ${jobs.length} (limit ${limit})`)
    out(`- text names no single country (left empty): ${none}`)
    out(`- ${apply ? 'written' : 'would be written'}, JSON-LD identical either way: **${identical}**`)
    out(`- JSON-LD would CHANGE (left alone, for a person to decide): ${changed}`)
    out()
    out('Most common texts that get a country:')
    for (const [text, e] of [...byText.entries()].sort((a, b) => b[1].jobs - a[1].jobs).slice(0, 25)) out(`  ${e.jobs} x "${text}" -> ${e.country}`)
    if (changedSamples.length) {
      out()
      out('Jobs whose JSON-LD would change (not written):')
      for (const s of changedSamples) out(s)
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
