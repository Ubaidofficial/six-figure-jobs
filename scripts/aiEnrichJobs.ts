/**
 * Batch AI enrich jobs (idempotent):
 * - selects non-expired jobs where aiOneLiner is null
 * - generates {oneLiner, snippet, bullets} (cached in DB)
 * - enforces hard cost guardrails with AiRunLedger day bucket
 */
import { prisma } from '../lib/prisma'
import { enrichJobWithAI } from '../lib/ai/openaiEnricher'
import { buildSnippetFromJob } from '../lib/jobs/snippet'

function envInt(name: string, def: number) {
  const v = process.env[name]
  if (!v) return def
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

function dayBucketUtc(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

async function getOrCreateLedger(day = dayBucketUtc()) {
  return prisma.aiRunLedger.upsert({
    where: { day },
    create: { day },
    update: {},
  })
}

async function main() {
  const pageSize = envInt('AI_ENRICH_PAGE_SIZE', 100)
  const maxJobsPerRun = envInt('AI_ENRICH_MAX_JOBS_PER_RUN', 400)
  const maxOutputTokens = envInt('AI_ENRICH_MAX_OUTPUT_TOKENS', 220)
  const maxDailyTokensTotal = envInt('AI_ENRICH_MAX_DAILY_TOKENS_TOTAL', 120000)

  const day = dayBucketUtc()
  const ledger = await getOrCreateLedger(day)

  const alreadyTotal = (ledger.tokensIn || 0) + (ledger.tokensOut || 0)
  if (alreadyTotal >= maxDailyTokensTotal) {
    console.log('[ai-enrich] Daily token cap reached; exiting.')
    return
  }

  let processed = 0
  let cursor: string | undefined

  while (processed < maxJobsPerRun) {
    const jobs = await prisma.job.findMany({
      where: {
        isExpired: false,
        aiOneLiner: null,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(pageSize, maxJobsPerRun - processed),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        descriptionHtml: true,
        description: true,
        locationRaw: true,
        primaryLocation: true,
        locationsJson: true,
      },
    })

    if (!jobs.length) break

    for (const job of jobs) {
      // Re-check ledger each job
      const fresh = await prisma.aiRunLedger.findUnique({ where: { day } })
      const total = (fresh?.tokensIn || 0) + (fresh?.tokensOut || 0)
      if (total >= maxDailyTokensTotal) {
        console.log('[ai-enrich] Daily token cap hit mid-run; stopping.')
        return
      }

      const roleSnippet = buildSnippetFromJob({
        title: job.title || '',
        descriptionHtml: job.descriptionHtml ?? undefined,
        descriptionText: job.description ?? undefined,
      })

      const locationHint =
        (job.primaryLocation && typeof job.primaryLocation === 'object' && 'locationRaw' in (job.primaryLocation as any))
          ? String((job.primaryLocation as any).locationRaw || '')
          : (job.locationRaw || '')

      try {
        const { out, tokensIn, tokensOut } = await enrichJobWithAI({
          title: job.title || '',
          roleSnippet,
          locationHint: locationHint || undefined,
          maxOutputTokens,
        })

        await prisma.$transaction([
          prisma.job.update({
            where: { id: job.id },
            data: {
              aiOneLiner: out.oneLiner.trim(),
              aiSnippet: out.snippet.trim(),
              aiSummaryJson: { bullets: out.bullets },
              aiEnrichedAt: new Date(),
            },
          }),
          prisma.aiRunLedger.update({
            where: { day },
            data: {
              jobsProcessed: { increment: 1 },
              tokensIn: { increment: tokensIn },
              tokensOut: { increment: tokensOut },
            },
          }),
        ])

        processed++
        console.log(`[ai-enrich] ok job=${job.id} processed=${processed}`)
      } catch (e) {
        // safe: do not fail the whole run; keep moving
        console.error(`[ai-enrich] failed job=${job.id}`, e)
      }
    }

    cursor = jobs[jobs.length - 1]!.id
  }

  console.log(`[ai-enrich] done processed=${processed}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
