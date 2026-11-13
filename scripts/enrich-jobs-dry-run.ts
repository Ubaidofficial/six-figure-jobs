// scripts/enrich-jobs-dry-run.ts
//
// A DRY RUN of free-LLM job enrichment: it picks the day's jobs (lib/ai/enrichSelection.ts), builds the prompts, and, if a free
// provider key is set, asks the free model for the rewrite and checks it against the posting (lib/ai/enrichValidate.ts). It
// prints the result for a person to judge. It WRITES NOTHING: the database is read inside a READ ONLY transaction and this file
// has no write call. Without a key it is prompt-only (selection and token sizes).
//
//   npm run ai:enrich:dry-run -- --limit=10 --provider=auto
//
// Free only: OpenRouter ":free" models and Cloudflare Workers AI's daily allowance; see lib/ai/freeLlm.ts for the guards.
import { appendFileSync } from 'node:fs'

import { buildAiEnrichPrompt, parseAiEnrichJson } from '../lib/ai/aiEnrichPrompt'
import { estimateTokens, parseSampleSize, pickProvider, stripHtml } from '../lib/ai/enrichDryRun'
import { MAX_JOB_AGE_DAYS, isEnrichable, selectJobsToEnrich, type EnrichCandidate } from '../lib/ai/enrichSelection'
import { validateEnrichment } from '../lib/ai/enrichValidate'
import { DailyCap, FreeOnlyViolation, QuotaExhausted, chatCloudflare, chatOpenRouter, parseJsonObject, rankFreeOpenRouterModels, type OpenRouterModelInfo } from '../lib/ai/freeLlm'
import { isPriorityCompanySlug } from '../lib/seo/priorityCompanies'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]

// Free models on OpenRouter come and go and are often rate-limited: OPENROUTER_MODEL (must end in ":free") wins, else
// today's free list gives the models to try in order (at most MAX_MODELS, so a bad day cannot burn many requests).
const MAX_MODELS = 4
async function resolveOpenRouterModels(): Promise<string[]> {
  const set = process.env.OPENROUTER_MODEL?.trim()
  if (set) return [set]
  const res = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`OpenRouter model list answered ${res.status}`)
  const ranked = rankFreeOpenRouterModels(((await res.json()) as { data?: OpenRouterModelInfo[] }).data ?? [])
  if (!ranked.length) throw new Error('OpenRouter lists no free text model today; set OPENROUTER_MODEL or use provider=cloudflare')
  return ranked.slice(0, MAX_MODELS)
}
const CLOUDFLARE_MODEL = process.env.CLOUDFLARE_MODEL?.trim() || '@cf/meta/llama-3.1-8b-instruct'

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const { prisma } = await import('../lib/prisma')
  const limit = parseSampleSize(arg('limit'))
  const provider = pickProvider(process.env, arg('provider'))
  const openRouterModels = provider === 'openrouter' ? await resolveOpenRouterModels() : []
  let modelIndex = 0
  if (openRouterModels.length) out(`OpenRouter free models to try, in order: ${openRouterModels.join(', ')}`)
  const lines: string[] = ['## Free-LLM enrichment dry run', '', 'Nothing is written to the database.', '']
  const out = (s = '') => lines.push(s)

  const since = new Date(Date.now() - (MAX_JOB_AGE_DAYS + 1) * 86_400_000)
  const rows = await prisma
    .$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY') // must be the first statement
        return tx.job.findMany({
          where: {
            isExpired: false,
            aiEnrichedAt: null,
            descriptionHtml: { not: null },
            OR: [{ postedAt: { gte: since } }, { postedAt: null, createdAt: { gte: since } }],
          },
          select: {
            id: true, title: true, source: true, locationRaw: true, descriptionHtml: true, createdAt: true, postedAt: true,
            aiEnrichedAt: true, isExpired: true, maxAnnual: true, currency: true, companyRef: { select: { slug: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 3000,
        })
      },
      { timeout: 60_000, maxWait: 30_000 },
    )
    .finally(() => prisma.$disconnect())

  const now = new Date()
  const candidates: Array<EnrichCandidate & { title: string; source: string; locationRaw: string | null }> = rows.map((r) => ({
    ...r,
    companySlug: r.companyRef?.slug ?? null,
  }))
  const priority = new Set(candidates.map((c) => c.companySlug).filter((s): s is string => isPriorityCompanySlug(s)))
  const chosen = selectJobsToEnrich(candidates, { limit, now, priorityCompanySlugs: priority }) as typeof candidates
  const eligible = candidates.filter((c) => isEnrichable(c, now)).length

  out(`Provider: **${provider}**${provider === 'none' ? ' (no free key set, so prompt-only)' : ''}`)
  out(`Recent jobs read: ${candidates.length} | eligible (long enough, not yet enriched): ${eligible} | chosen for this sample: ${chosen.length}`)
  out()

  const cap = new DailyCap(limit)
  let ok = 0, flagged = 0, failed = 0, consecutiveFailures = 0, tokensIn = 0
  for (const job of chosen) {
    const roleSnippet = stripHtml(job.descriptionHtml).slice(0, 6000)
    const prompt = buildAiEnrichPrompt({ title: job.title, roleSnippet, locationHint: job.locationRaw ?? undefined, maxOutputTokens: 1500 })
    const t = estimateTokens(prompt)
    tokensIn += t
    out(`### ${job.title} (${job.source})`)
    out(`Source text ${roleSnippet.length} chars, prompt about ${t} tokens.`)

    if (provider === 'none') { out(); continue }
    if (!cap.take()) { out('Stopped: sample limit reached.'); break }
    try {
      // A 429 on one free model moves to the next; the run stops only when every model has refused.
      const askOpenRouter = async () => {
        for (;;) {
          try {
            return await chatOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY!, model: openRouterModels[modelIndex], messages: [{ role: 'user', content: prompt }], maxTokens: 1500 })
          } catch (e) {
            if (!(e instanceof QuotaExhausted) || modelIndex + 1 >= openRouterModels.length) throw e
            out(`Rate-limited, trying the next free model: ${e.message}`)
            modelIndex++
          }
        }
      }
      const res =
        provider === 'openrouter'
          ? await askOpenRouter()
          : await chatCloudflare({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID!, apiToken: process.env.CLOUDFLARE_API_TOKEN!, model: CLOUDFLARE_MODEL, messages: [{ role: 'user', content: prompt }], maxTokens: 1500 })
      const obj = parseJsonObject(res.text)
      if (!obj) throw new Error('the model did not return a JSON object')
      const parsed = parseAiEnrichJson(JSON.stringify(obj))
      const check = validateEnrichment(parsed, roleSnippet)
      consecutiveFailures = 0
      if (check.ok) ok++
      else flagged++
      out(`Model: ${res.model} | ${check.ok ? 'passed the checks' : `FLAGGED: ${check.problems.join('; ')}`}`)
      out(`- One-liner: ${parsed.oneLiner}`)
      out(`- Snippet: ${parsed.snippet}`)
      for (const [label, items] of [['Responsibilities', parsed.description], ['Requirements', parsed.requirements], ['Benefits', parsed.benefits]] as const) {
        if (items.length) { out(`- ${label}:`); items.forEach((b) => out(`  - ${b}`)) }
      }
      if (parsed.techStack?.length) out(`- Tech: ${parsed.techStack.join(', ')}`)
    } catch (e) {
      if (e instanceof FreeOnlyViolation) { out(`**STOPPED (free-only guard):** ${e.message}`); failed++; process.exitCode = 1; break }
      if (e instanceof QuotaExhausted) { out(`**STOPPED (free quota used up on every model tried):** ${e.message}`); break }
      failed++; consecutiveFailures++
      out(`FAILED: ${e instanceof Error ? e.message : String(e)}`)
      if (consecutiveFailures >= 3) { out('Stopped after 3 failures in a row.'); break }
    }
    out()
  }

  out('---')
  out(`Done. Passed ${ok}, flagged ${flagged}, failed ${failed}. About ${tokensIn} input tokens across ${chosen.length} prompts. No database writes.`)
  const report = lines.join('\n')
  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
