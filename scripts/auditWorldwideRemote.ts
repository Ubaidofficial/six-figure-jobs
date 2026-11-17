// scripts/auditWorldwideRemote.ts
//
// READ-ONLY. Why does /remote?remoteRegion=global ("Anywhere in the world") list so few jobs, and which jobs does it leave out?
// The rule (lib/jobs/remoteRegions.ts, WORLDWIDE_CLAUSE) needs a remote job with NO country whose location text says
// worldwide / anywhere / global and names nothing that limits it. This reads the live remote jobs and counts where that
// rule can miss (owner's question, 2026-11-17, after seeing "Anywhere in the world 29 jobs"):
//  1. remote jobs with no country, by their location text (what do they say instead of "worldwide"?);
//  2. worldwide words in the location text but a country is stored, so the job is not counted;
//  3. worldwide words in the location text but a "limiting" word hits (a US/EU word, or a substring such as "india" in "Indiana");
//  4. remote jobs whose location says nothing but whose own description says they can be worked from anywhere (the sentence is quoted).
// Every statement is a SELECT in a READ ONLY transaction. Output is public job data for a person to review.
//
//   npx tsx scripts/auditWorldwideRemote.ts
import { appendFileSync } from 'node:fs'

import { isWorldwideLocationText } from '../lib/jobs/remoteRegions'
import { plainPostingText, splitSentences } from '../lib/jobs/verifiedQuote'

const WORLDWIDE_WORDS = /worldwide|anywhere|global/i
// A posting sentence that says the role can be done from any country: "work from anywhere", "anywhere in the world",
// "open to candidates worldwide", "any country". Not "global company" or "global team".
const ANYWHERE_SENTENCE = /\b(?:work(?:ing)? from anywhere|from anywhere in the world|anywhere in the world|(?:candidates|applicants|talent|hiring|hire|open|apply|located|based)\b[^.;]{0,40}\b(?:worldwide|globally|anywhere|in any country)|any country|any time ?zone)\b/i
// A sentence that limits the answer again ("anywhere in the US", "within the EU").
const LIMITED_SENTENCE = /\b(?:u\.?s\.?a?|united states|canada|u\.?k\.?|united kingdom|europe|eu|emea|apac|latam|time ?zones?|overlap|authori[sz]ed to work|eligible to work|work authori[sz]ation)\b/i

export type Row = { id: string; source: string; title: string; locationRaw: string | null; countryCode: string | null; descriptionHtml: string | null }

/** Why a remote job is not in the worldwide list, from its own fields (pure). */
export function worldwideGap(r: Pick<Row, 'locationRaw' | 'countryCode'>): 'listed' | 'country-stored' | 'limiting-word' | 'no-worldwide-words' {
  const loc = r.locationRaw ?? ''
  if (!WORLDWIDE_WORDS.test(loc)) return 'no-worldwide-words'
  if (r.countryCode) return 'country-stored'
  return isWorldwideLocationText(loc) ? 'listed' : 'limiting-word'
}

/** The sentence in which a posting says it can be worked from anywhere, or null (pure). */
export function anywhereSentence(descriptionHtml: string | null | undefined): string | null {
  for (const s of splitSentences(plainPostingText(descriptionHtml))) if (ANYWHERE_SENTENCE.test(s) && !LIMITED_SENTENCE.test(s)) return s
  return null
}

const norm = (t: string | null) => (t ?? '(empty)').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60)

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const out: string[] = ['## Anywhere-in-the-world remote jobs: what the rule leaves out (read-only)', '']
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        const rows = (await tx.job.findMany({
          where: { isExpired: false, OR: [{ remote: true }, { remoteMode: 'remote' }] },
          select: { id: true, source: true, title: true, locationRaw: true, countryCode: true, descriptionHtml: true },
          take: 30000,
        })) as Row[]
        const gap = new Map<string, number>()
        const noCountryText = new Map<string, number>()
        const samples = new Map<string, string[]>()
        const fromText: string[] = []
        let fromTextCount = 0
        for (const r of rows) {
          const g = worldwideGap(r)
          gap.set(g, (gap.get(g) ?? 0) + 1)
          if (!r.countryCode) noCountryText.set(norm(r.locationRaw), (noCountryText.get(norm(r.locationRaw)) ?? 0) + 1)
          if (g === 'country-stored' || g === 'limiting-word') {
            const l = samples.get(g) ?? []
            if (l.length < 25) l.push(`- ${r.source} | "${(r.locationRaw ?? '').slice(0, 70)}" | country=${r.countryCode} | ${r.title.slice(0, 50)}`)
            samples.set(g, l)
          }
          if (g === 'no-worldwide-words') {
            const s = anywhereSentence(r.descriptionHtml)
            if (s) {
              fromTextCount++
              if (fromText.length < 40) fromText.push(`- ${r.source} | "${(r.locationRaw ?? '').slice(0, 40)}" | country=${r.countryCode} | ${r.title.slice(0, 45)} | "${s.replace(/\s+/g, ' ').slice(0, 200)}"`)
            }
          }
        }
        out.push(`${rows.length} live remote jobs.`, '', '| result | jobs |', '| --- | --- | ')
        for (const k of ['listed', 'country-stored', 'limiting-word', 'no-worldwide-words']) out.push(`| ${k} | ${gap.get(k) ?? 0} |`)
        out.push('', `Remote jobs with no country: ${[...noCountryText.values()].reduce((a, b) => a + b, 0)}. Their most common location texts:`, '')
        for (const [t, n] of [...noCountryText].sort((a, b) => b[1] - a[1]).slice(0, 25)) out.push(`- ${n} x "${t}"`)
        for (const k of ['country-stored', 'limiting-word']) out.push('', `### Worldwide words in the location but ${k === 'country-stored' ? 'a country is stored' : 'a limiting word hits'} (up to 25)`, '', ...(samples.get(k) ?? ['(none)']))
        out.push('', `### Location says nothing, description says anywhere (${fromTextCount} jobs; first 40, review for wrong readings)`, '', ...(fromText.length ? fromText : ['(none)']))
      },
      { timeout: 180_000, maxWait: 30_000 },
    )
  } finally {
    await prisma.$disconnect()
  }
  const report = out.join('\n')
  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
