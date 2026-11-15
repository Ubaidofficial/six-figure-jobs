// scripts/fill-company-profiles.ts
//
// Fills EMPTY company profile fields from free sources (rules in lib/companies/profileFill.ts): founding year (the company's own
// page, else Wikidata by official website), LinkedIn page (only one the company's own page links) and a neutral description
// (a free model restates the page's tagline; kept only if it adds nothing the tagline did not say). A DRY RUN unless --apply:
// without it nothing is written. Companies with the most live jobs first. Never overwrites a stored value (every write is
// guarded by "that field is still empty").
//
//   npx tsx scripts/fill-company-profiles.ts [--limit=50] [--provider=auto|cloudflare|openrouter|none] [--ai-max=60] [--only="Stripe,Datadog"] [--apply]
//
// --only limits the run to companies with those exact names (case-insensitive), so a person who has read a dry run can apply
// just the companies whose text was approved. The model's wording can differ between two runs: read the apply log too.
//
// Polite: one homepage request per company 1.5 s apart (honest User-Agent, a 401/403/429 skips that company), Wikidata 10
// companies per query 2 s apart (an error ends the lookup, never retried). Free only: lib/ai/freeLlm.ts refuses anything that
// could cost money. The free model allowance is shared with `ai enrich free`, which this script does not count.
import { appendFileSync } from 'node:fs'

import { buildCompanyDescriptionPrompt, homepageOf, planProfileFill, validateCompanyDescription, type ProfilePlan } from '../lib/companies/profileFill'
import { parseSiteProfile, type SiteProfile } from '../lib/companies/profileFromSite'
import { buildWikidataQuery, parseWikidataBindings, siteKey, type WikidataProfile } from '../lib/companies/wikidataProfile'
import { createFreeAsker, pickFreeProvider } from '../lib/ai/freeEnrichRunner'
import { FreeOnlyViolation, QuotaExhausted, parseJsonObject } from '../lib/ai/freeLlm'
import { parseLimit } from '../lib/ai/freeEnrichWrite'
import { makePoliteGetter } from '../lib/scrapers/utils/politeFetch'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const apply = process.argv.includes('--apply')

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const limit = parseLimit(arg('limit'), 50, 200)
  const aiMax = parseLimit(arg('ai-max'), 60, 150)
  const provider = pickFreeProvider(process.env, arg('provider'))
  const lines: string[] = [`## Company profile fill (${apply ? 'APPLY' : 'dry run, nothing written'})`, '']
  const out = (s = '') => lines.push(s)

  try {
    const rows = await prisma.company.findMany({
      where: {
        website: { not: null },
        jobs: { some: { isExpired: false } },
        OR: [{ foundedYear: null }, { linkedinUrl: null }, { description: null }, { description: '' }],
      },
      select: { id: true, name: true, website: true, foundedYear: true, linkedinUrl: true, description: true },
      orderBy: { jobCount: 'desc' },
      take: limit * 3,
    })
    const only = new Set((arg('only') ?? '').split(',').map((n) => n.trim().toLowerCase()).filter(Boolean))
    const candidates = rows.flatMap((r) => {
      const url = homepageOf(r.website)
      return url && (!only.size || only.has(r.name.trim().toLowerCase())) ? [{ ...r, url }] : []
    }).slice(0, limit)
    out(`Companies read: ${rows.length} | with their own website and something empty: ${candidates.length} (limit ${limit}) | free model: **${provider}**`)
    out()

    // 1. The company's own page.
    const get = makePoliteGetter({ gapMs: 1500 })
    const site = new Map<string, SiteProfile | null>()
    for (const c of candidates) {
      let html: string | null = null
      try {
        html = await get(c.url)
      } catch {
        html = null
      }
      site.set(c.id, html ? parseSiteProfile(html) : null)
    }

    // 2. Wikidata, only for companies still without a founding year.
    const wiki = new Map<string, WikidataProfile>()
    const needYear = candidates.filter((c) => !c.foundedYear && !site.get(c.id)?.foundingYear)
    const hosts = [...new Set(needYear.map((c) => siteKey(c.url)).filter((h): h is string => Boolean(h)))]
    let wikiStopped: string | null = null
    for (let i = 0; i < hosts.length; i += 10) {
      if (i > 0) await new Promise((r) => setTimeout(r, 2000))
      try {
        const res = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query: buildWikidataQuery(hosts.slice(i, i + 10)), format: 'json' })}`, {
          headers: { 'User-Agent': 'SixFigureJobsBot/1.0 (+https://www.6figjobs.com)', Accept: 'application/sparql-results+json' },
          signal: AbortSignal.timeout(90_000),
        })
        if (!res.ok) {
          wikiStopped = `HTTP ${res.status}`
          break
        }
        for (const [h, p] of parseWikidataBindings((await res.json()).results.bindings)) wiki.set(h, p)
      } catch (err) {
        wikiStopped = err instanceof Error ? err.message : String(err)
        break
      }
    }
    if (wikiStopped) out(`Wikidata lookup stopped: ${wikiStopped} (founding years from Wikidata are incomplete this run)`)

    // 3. Plan, restate taglines, write.
    const ask = provider === 'none' ? null : await createFreeAsker({ provider, env: process.env, log: (l) => out(l), maxTokens: 300 })
    let aiCalls = 0
    let aiStopped = false
    let aiFailures = 0
    const totals = { foundedYear: 0, linkedinUrl: 0, description: 0, rejectedDescription: 0, nothing: 0 }
    for (const c of candidates) {
      const plan: ProfilePlan = planProfileFill(c, site.get(c.id) ?? null, wiki.get(siteKey(c.url) ?? ''))
      let description: string | null = null
      let descriptionNote = ''
      if (plan.taglineForDescription && ask && !aiStopped && aiCalls < aiMax) {
        aiCalls++
        try {
          const res = await ask(buildCompanyDescriptionPrompt(c.name, plan.taglineForDescription))
          aiFailures = 0
          const check = validateCompanyDescription(parseJsonObject(res.text)?.description, c.name, plan.taglineForDescription)
          if (check.ok) description = check.text
          else {
            totals.rejectedDescription++
            descriptionNote = `description rejected (${check.reason})`
          }
        } catch (e) {
          if (e instanceof FreeOnlyViolation) {
            out(`**STOPPED (free-only guard):** ${e.message}`)
            process.exitCode = 1
            aiStopped = true
          } else if (e instanceof QuotaExhausted) {
            out(`**Free model quota used up:** ${e.message}`)
            aiStopped = true
          } else if (++aiFailures >= 3) {
            out('Free model failed 3 times in a row; descriptions skipped for the rest of the run.')
            aiStopped = true
          }
        }
      }

      const data: { foundedYear?: number; linkedinUrl?: string; description?: string } = {}
      if (plan.foundedYear) data.foundedYear = plan.foundedYear.value
      if (plan.linkedinUrl) data.linkedinUrl = plan.linkedinUrl.value
      if (description) data.description = description
      if (!Object.keys(data).length) {
        totals.nothing++
        continue
      }
      out(`### ${c.name} (${c.url})`)
      if (plan.foundedYear) out(`- Founded: ${plan.foundedYear.value} (${plan.foundedYear.source})`)
      if (plan.linkedinUrl) out(`- LinkedIn: ${plan.linkedinUrl.value}`)
      if (description) out(`- Description: ${description}\n  - from the tagline: "${(plan.taglineForDescription ?? '').slice(0, 200)}"`)
      if (descriptionNote) out(`- ${descriptionNote}`)
      out()

      if (data.foundedYear) totals.foundedYear++
      if (data.linkedinUrl) totals.linkedinUrl++
      if (data.description) totals.description++
      if (apply) {
        // Each field only while it is still empty: a value written meanwhile (by a scrape or a person) is never replaced.
        if (data.foundedYear) await prisma.company.updateMany({ where: { id: c.id, foundedYear: null }, data: { foundedYear: data.foundedYear } })
        if (data.linkedinUrl) await prisma.company.updateMany({ where: { id: c.id, linkedinUrl: null }, data: { linkedinUrl: data.linkedinUrl } })
        if (data.description) await prisma.company.updateMany({ where: { id: c.id, OR: [{ description: null }, { description: '' }] }, data: { description: data.description } })
      }
    }

    out('---')
    out(`${apply ? 'Wrote' : 'Would write'}: founding year ${totals.foundedYear}, LinkedIn ${totals.linkedinUrl}, description ${totals.description}. Descriptions rejected by the check: ${totals.rejectedDescription}. Nothing to add: ${totals.nothing}. Free model calls: ${aiCalls}.`)
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
