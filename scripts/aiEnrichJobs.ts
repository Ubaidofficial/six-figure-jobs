/**
 * Batch AI enrich jobs (idempotent):
 * - selects non-expired jobs where aiOneLiner is null
 * - generates {oneLiner, snippet, bullets} (cached in DB)
 * - enforces hard cost guardrails with AiRunLedger day bucket
 */
import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'
import { enrichJobWithAI } from '../lib/ai/openaiEnricher'
import { buildSnippetFromJob } from '../lib/jobs/snippet'
import { buildGlobalExclusionsWhere, buildHighSalaryEligibilityWhere } from '../lib/jobs/queryJobs'
import { extractTechStackFromText } from '../lib/tech/extractTechStack'
import slugify from 'slugify'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")

function normalizeSkillSlug(input: string): string | null {
  const raw = String(input || '').trim()
  if (!raw) return null
  const lowered = raw.toLowerCase().replace(/\s+/g, ' ').trim()

  if (lowered === 'c#' || lowered === 'c sharp' || lowered === 'csharp') return 'csharp'
  if (lowered === 'c++' || lowered === 'cpp') return 'cpp'
  if (lowered === '.net' || lowered === 'dotnet' || lowered === 'dot net') return 'dotnet'

  const slug = slugify(raw, { lower: true, strict: true, trim: true })
  return slug || null
}

function uniqSlugs(items: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const s = typeof item === 'string' ? item.trim() : ''
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}


function envInt(name: string, def: number) {
  const v = process.env[name]
  if (!v) return def
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

function envFloat(name: string, def: number) {
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

function daysAgoUtc(days: number) {
  const now = new Date()
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

function estUsd(tokensIn: number, tokensOut: number, inPerM: number, outPerM: number) {
  return (tokensIn / 1_000_000) * inPerM + (tokensOut / 1_000_000) * outPerM
}

async function selectJobsToEnrich(params: {
  take: number
  recentDays: number
  roleGroupsPerRun: number
  topPerRole: number
}) {
  const baseWhere = {
    isExpired: false,
    aiEnrichedAt: null,
    AND: [buildGlobalExclusionsWhere(), buildHighSalaryEligibilityWhere()],
  } as const

  const selected = new Map<string, any>()

  // Priority 1: Recent + high salary eligible
  if (selected.size < params.take) {
    const recentSince = daysAgoUtc(params.recentDays)
    const tier1 = await prisma.job.findMany({
      where: { ...baseWhere, createdAt: { gte: recentSince } },
      orderBy: [{ minAnnual: 'desc' }, { createdAt: 'desc' }],
      take: params.take - selected.size,
      select: {
        id: true,
        title: true,
        descriptionHtml: true,
        locationRaw: true,
        primaryLocation: true,
        locationsJson: true,
        roleSlug: true,
      },
    })
    for (const j of tier1) selected.set(j.id, j)
  }

  // Priority 2: Top N per role category (for diversity)
  if (selected.size < params.take) {
    const roleGroups = await prisma.job.groupBy({
      by: ['roleSlug'],
      where: { ...baseWhere, roleSlug: { not: null } },
      _max: { minAnnual: true },
      _count: { _all: true },
      orderBy: [{ _max: { minAnnual: 'desc' } }, { _count: { id: 'desc' } }],
      take: params.roleGroupsPerRun,
    })

    for (const g of roleGroups) {
      if (selected.size >= params.take) break
      const roleSlug = g.roleSlug
      if (!roleSlug) continue

      const remaining = params.take - selected.size
      const jobs = await prisma.job.findMany({
        where: { ...baseWhere, roleSlug, id: { notIn: Array.from(selected.keys()) } },
        orderBy: [{ minAnnual: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(params.topPerRole, remaining),
        select: {
          id: true,
          title: true,
          descriptionHtml: true,
          locationRaw: true,
          primaryLocation: true,
          locationsJson: true,
          roleSlug: true,
        },
      })
      for (const j of jobs) selected.set(j.id, j)
    }
  }

  // Priority 3: Remaining high-salary eligible jobs (highest salary first)
  if (selected.size < params.take) {
    const tier3 = await prisma.job.findMany({
      where: { ...baseWhere, id: { notIn: Array.from(selected.keys()) } },
      orderBy: [{ minAnnual: 'desc' }, { createdAt: 'desc' }],
      take: params.take - selected.size,
      select: {
        id: true,
        title: true,
        descriptionHtml: true,
        locationRaw: true,
        primaryLocation: true,
        locationsJson: true,
        roleSlug: true,
      },
    })
    for (const j of tier3) selected.set(j.id, j)
  }

  return Array.from(selected.values())
}

async function main() {
  const maxJobsPerRun = envInt('AI_ENRICH_MAX_JOBS_PER_RUN', 200)
  const maxOutputTokens = envInt('AI_ENRICH_MAX_OUTPUT_TOKENS', 220)
  const maxDailyTokensTotal = envInt('AI_ENRICH_MAX_DAILY_TOKENS_TOTAL', 500000)
  const maxDailyJobs = envInt('AI_ENRICH_MAX_DAILY_JOBS', 500)
  const recentDays = envInt('AI_ENRICH_RECENT_DAYS', 30)
  const roleGroupsPerRun = envInt('AI_ENRICH_ROLE_GROUPS_PER_RUN', 12)
  const topPerRole = envInt('AI_ENRICH_TOP_PER_ROLE', 50)

  // Cost tracking (override with actual DeepSeek pricing if different)
  const costInPerMillion = envFloat('AI_COST_IN_USD_PER_MILLION', 0.14)
  const costOutPerMillion = envFloat('AI_COST_OUT_USD_PER_MILLION', 0.28)
  const maxDailyUsd = envFloat('AI_ENRICH_MAX_DAILY_USD', 0.33)

  const day = dayBucketUtc()
  const ledger = await getOrCreateLedger(day)

  const alreadyTotal = (ledger.tokensIn || 0) + (ledger.tokensOut || 0)
  if (alreadyTotal >= maxDailyTokensTotal) {
    __slog('[ai-enrich] Daily token cap reached; exiting.')
    return
  }

  if ((ledger.jobsProcessed || 0) >= maxDailyJobs) {
    __slog('[ai-enrich] Daily job cap reached; exiting.')
    return
  }

  const alreadyUsd = estUsd(ledger.tokensIn || 0, ledger.tokensOut || 0, costInPerMillion, costOutPerMillion)
  if (alreadyUsd >= maxDailyUsd) {
    __slog(`[ai-enrich] Daily USD cap reached ($${alreadyUsd.toFixed(4)} >= $${maxDailyUsd.toFixed(2)}); exiting.`)
    return
  }

  let processed = 0
  const jobs = await selectJobsToEnrich({
    take: maxJobsPerRun,
    recentDays,
    roleGroupsPerRun,
    topPerRole,
  })

  if (!jobs.length) {
    __slog('[ai-enrich] No eligible jobs found.')
    return
  }

  for (const job of jobs) {
    // Re-check ledger each job
    const fresh = await prisma.aiRunLedger.findUnique({ where: { day } })
    const total = (fresh?.tokensIn || 0) + (fresh?.tokensOut || 0)
    if (total >= maxDailyTokensTotal) {
      __slog('[ai-enrich] Daily token cap hit mid-run; stopping.')
      return
    }

    if ((fresh?.jobsProcessed || 0) >= maxDailyJobs) {
      __slog('[ai-enrich] Daily job cap hit mid-run; stopping.')
      return
    }

    const dayUsd = estUsd(fresh?.tokensIn || 0, fresh?.tokensOut || 0, costInPerMillion, costOutPerMillion)
    if (dayUsd >= maxDailyUsd) {
      __slog(`[ai-enrich] Daily USD cap hit mid-run ($${dayUsd.toFixed(4)}); stopping.`)
      return
    }

    const roleSnippet = buildSnippetFromJob({
      title: job.title || '',
      descriptionHtml: job.descriptionHtml ?? undefined,
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

      const techFromText = extractTechStackFromText(`${job.title}\n${roleSnippet}`)
      const aiTech = Array.isArray(out.techStack) ? out.techStack : []
      const aiSkills = Array.isArray(out.skills) ? out.skills : []

      const techDisplay = aiTech.length ? aiTech : techFromText.display
      const techStack = techDisplay.length ? JSON.stringify(techDisplay) : undefined

      const skillsSlugs = aiSkills.length
        ? uniqSlugs(aiSkills.map(normalizeSkillSlug))
        : techFromText.slugs
      const skillsJson = skillsSlugs.length ? JSON.stringify(skillsSlugs) : undefined

      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: {
            aiOneLiner: out.oneLiner.trim(),
            aiSnippet: out.snippet.trim(),
            aiSummaryJson: {
              bullets: out.bullets || [],
              description: out.description || [],
              requirements: out.requirements || [],
              benefits: out.benefits || [],
            },
            techStack,
            skillsJson,
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
      const jobUsd = estUsd(tokensIn, tokensOut, costInPerMillion, costOutPerMillion)
      __slog(
        `[ai-enrich] ok job=${job.id} processed=${processed}/${jobs.length} tokensIn=${tokensIn} tokensOut=${tokensOut} estUsd=$${jobUsd.toFixed(5)}`,
      )
    } catch (e) {
      // safe: do not fail the whole run; keep moving
      __serr(`[ai-enrich] failed job=${job.id}`, e)
    }
  }

  const final = await prisma.aiRunLedger.findUnique({ where: { day } })
  const finalUsd = estUsd(final?.tokensIn || 0, final?.tokensOut || 0, costInPerMillion, costOutPerMillion)
  __slog(
    `[ai-enrich] done processed=${processed} dayJobs=${final?.jobsProcessed || 0}/${maxDailyJobs} ` +
    `dayTokens=${(final?.tokensIn || 0) + (final?.tokensOut || 0)}/${maxDailyTokensTotal} ` +
    `dayUsd=$${finalUsd.toFixed(4)}/${maxDailyUsd.toFixed(2)}`,
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    __serr(e)
    await prisma.$disconnect()
    process.exit(1)
  })
