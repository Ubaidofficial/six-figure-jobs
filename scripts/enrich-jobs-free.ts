// scripts/enrich-jobs-free.ts
//
// The FREE enrichment writer: asks a free model (Cloudflare Workers AI's free daily allowance first, OpenRouter ":free" models as
// the fallback) to rewrite the day's best new jobs into a short, structured summary, checks every answer against the posting, and
// (only with --apply) saves it in the fields the job page already shows (aiOneLiner, aiSnippet, aiSummaryJson). Free only:
// lib/ai/freeLlm.ts refuses anything that could cost money, and the run stops at the first sign of a quota or a violation.
//
// Rules this keeps (docs/FREE_ENRICHMENT_PLAN.md):
//  - at most AI_FREE_DAILY_MAX (default 80) jobs per UTC day across all runs, counted from the database;
//  - one model call per DISTINCT description: a repost for another city gets the same summary;
//  - an answer is saved only when it passes the check against the posting (numbers, tech and benefits must be in it);
//  - a preferred / nice-to-have requirement is labelled "Preferred:", never shown as required;
//  - the original description is never changed; only jobs with no AI summary are written, and a write never overwrites one.
//
// A dry run (no --apply) calls the model and checks the answer but writes nothing.
//
//   npx tsx scripts/enrich-jobs-free.ts [--limit=40] [--provider=auto|cloudflare|openrouter] [--apply]
import { appendFileSync } from 'node:fs'

import { buildAiEnrichPrompt, parseAiEnrichJson } from '../lib/ai/aiEnrichPrompt'
import { stripHtml } from '../lib/ai/enrichDryRun'
import { MAX_JOB_AGE_DAYS, selectJobsToEnrich, type EnrichCandidate } from '../lib/ai/enrichSelection'
import { validateEnrichment } from '../lib/ai/enrichValidate'
import { createFreeAsker, pickFreeProvider } from '../lib/ai/freeEnrichRunner'
import { DEFAULT_DAILY_MAX, DEFAULT_RUN_LIMIT, MAX_RUN_LIMIT, buildJobUpdate, groupByDescription, normalizeEnrichment, parseLimit, remainingToday, startOfUtcDay, FREE_AI_VERSION } from '../lib/ai/freeEnrichWrite'
import { FreeOnlyViolation, QuotaExhausted, parseJsonObject } from '../lib/ai/freeLlm'
import { isPriorityCompanySlug } from '../lib/seo/priorityCompanies'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const apply = process.argv.includes('--apply')
const SOURCE_CHARS = 6000

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const lines: string[] = [`## Free enrichment ${apply ? 'WRITER (applying)' : 'dry run (nothing written)'}`, '']
  const out = (s = '') => lines.push(s)
  const flush = () => {
    const report = lines.join('\n')
    console.log(report)
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)
  }

  try {
    const provider = pickFreeProvider(process.env, arg('provider'))
    if (provider === 'none') {
      out('No free provider key is set (OPENROUTER_API_KEY, or CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN). Nothing to do.')
      return
    }
    const now = new Date()
    const dailyMax = parseLimit(process.env.AI_FREE_DAILY_MAX, DEFAULT_DAILY_MAX, 500)
    const runLimit = parseLimit(arg('limit'), DEFAULT_RUN_LIMIT, MAX_RUN_LIMIT)
    const doneToday = await prisma.job.count({ where: { aiVersion: FREE_AI_VERSION, lastAiEnrichedAt: { gte: startOfUtcDay(now) } } })
    const budget = remainingToday(dailyMax, doneToday, runLimit)
    out(`Provider: **${provider}** | enriched so far today (UTC): ${doneToday} of ${dailyMax} | this run may do: ${budget}`)
    if (budget <= 0) {
      out('The daily maximum is reached. Nothing to do.')
      return
    }

    const since = new Date(now.getTime() - (MAX_JOB_AGE_DAYS + 1) * 86_400_000)
    const rows = await prisma.job.findMany({
      where: {
        isExpired: false,
        aiEnrichedAt: null,
        aiOneLiner: null,
        salaryValidated: true,
        descriptionHtml: { not: null },
        OR: [{ postedAt: { gte: since } }, { postedAt: null, createdAt: { gte: since } }],
      },
      select: {
        id: true, title: true, source: true, locationRaw: true, descriptionHtml: true, createdAt: true, postedAt: true,
        aiEnrichedAt: true, isExpired: true, maxAnnual: true, currency: true, techStack: true, companyRef: { select: { slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3000,
    })
    const candidates: Array<EnrichCandidate & (typeof rows)[number]> = rows.map((r) => ({ ...r, companySlug: r.companyRef?.slug ?? null }))

    // One model call per distinct description: a repost for another city shares it.
    const groups = groupByDescription(candidates, (j) => stripHtml(j.descriptionHtml).slice(0, SOURCE_CHARS))
    const membersOf = new Map([...groups.values()].map((members) => [members[0].id, members] as const))
    const representatives = [...membersOf.values()].map((members) => members[0])
    const priority = new Set(candidates.map((c) => c.companySlug).filter((s): s is string => isPriorityCompanySlug(s)))
    const chosen = selectJobsToEnrich(representatives, { limit: budget, now, priorityCompanySlugs: priority }) as typeof representatives
    out(`Recent jobs read: ${candidates.length} | distinct descriptions: ${groups.size} | chosen for this run: ${chosen.length}`)
    out()

    const ask = await createFreeAsker({ provider, env: process.env, log: (line) => out(line) })
    let saved = 0, copies = 0, flagged = 0, failed = 0, consecutiveFailures = 0
    for (const job of chosen) {
      const roleSnippet = stripHtml(job.descriptionHtml).slice(0, SOURCE_CHARS)
      const prompt = buildAiEnrichPrompt({ title: job.title, roleSnippet, locationHint: job.locationRaw ?? undefined, maxOutputTokens: 1500 })
      try {
        const res = await ask(prompt)
        const obj = parseJsonObject(res.text)
        if (!obj) throw new Error('the model did not return a JSON object')
        const parsed = normalizeEnrichment(parseAiEnrichJson(JSON.stringify(obj)))
        const check = validateEnrichment(parsed, roleSnippet)
        consecutiveFailures = 0
        if (!check.ok) {
          flagged++
          out(`FLAGGED, not saved: ${job.title} (${job.source}): ${check.problems.join('; ')}`)
          continue
        }
        const model = `${provider}:${res.model}`
        const members = membersOf.get(job.id) ?? [job]
        if (apply) {
          for (const member of members) {
            // Only a job still without an AI summary is written: a concurrent run or an earlier pass is never overwritten.
            const { count } = await prisma.job.updateMany({ where: { id: member.id, aiEnrichedAt: null, aiOneLiner: null }, data: buildJobUpdate(parsed, { techStack: member.techStack }, model, new Date()) })
            if (count) saved++
          }
        } else {
          saved += members.length
        }
        copies += members.length - 1
        out(`${apply ? 'Saved' : 'Would save'}: ${job.title} (${job.source}) x${members.length} | ${model} | "${parsed.oneLiner.slice(0, 100)}"`)
      } catch (e) {
        if (e instanceof FreeOnlyViolation) {
          out(`**STOPPED (free-only guard):** ${e.message}`)
          process.exitCode = 1
          break
        }
        if (e instanceof QuotaExhausted) {
          out(`**STOPPED (free quota used up on every model tried):** ${e.message}`)
          break
        }
        failed++
        consecutiveFailures++
        out(`FAILED: ${job.title}: ${e instanceof Error ? e.message : String(e)}`)
        if (consecutiveFailures >= 3) {
          out('Stopped after 3 failures in a row.')
          break
        }
      }
    }
    out()
    out('---')
    out(`Done. ${apply ? 'Saved' : 'Would save'} ${saved} jobs (${copies} of them copies of an already-summarised description), flagged ${flagged}, failed ${failed}.`)
  } finally {
    flush()
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
