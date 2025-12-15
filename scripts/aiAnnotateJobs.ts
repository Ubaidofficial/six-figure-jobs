// scripts/aiAnnotateJobs.ts
// ---------------------------------------------------------------------
// AI enrichment script (safe + non-breaking):
//  - Legacy enrichment (existing behavior):
//      - Generates summary + bullets -> requirementsJson.summary + requirementsJson.bullets
//      - Extracts tech stack + keywords -> techStack / skillsJson
//      - Infers experienceLevel, workArrangement, visaSponsorship
//  - v2.9 enrichment (optional if DB columns exist):
//      - aiSummaryJson (structured, conservative)
//      - aiSnippet (<=160 chars)
//      - aiQualityScore (0–5)
//      - aiModel, aiVersion, lastAiEnrichedAt
//
// Usage:
//   OPENAI_API_KEY=... npx tsx scripts/aiAnnotateJobs.ts --limit=10 --dry-run
//
// Flags:
//   --limit=<n>         Limit jobs processed (default 10, max 200)
//   --dry-run           Do not write to DB; just log proposed updates
//   --company=<slug>    Only process jobs for a specific company slug
//   --min-quality=<n>   Minimum quality score required to write v2.9 AI fields (default 3)
//   --only-ai           Only write v2.9 AI fields (do not touch legacy fields)
//   --only-legacy       Only write legacy fields (do not touch v2.9 AI fields)
// ---------------------------------------------------------------------

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { annotateJobWithAI } from '../lib/ai/jobAnnotator'

const prisma = new PrismaClient()

type CliOptions = {
  limit: number
  dryRun: boolean
  company?: string | null
  minQuality: number
  onlyAi: boolean
  onlyLegacy: boolean
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const limitFlag = args.find((a) => a.startsWith('--limit='))
  const companyFlag = args.find((a) => a.startsWith('--company='))
  const minQualityFlag = args.find((a) => a.startsWith('--min-quality='))

  const limit = limitFlag ? Number(limitFlag.split('=')[1]) : 10
  const company = companyFlag ? companyFlag.split('=')[1] : null
  const minQuality = minQualityFlag ? Number(minQualityFlag.split('=')[1]) : 3

  const dryRun = args.includes('--dry-run')
  const onlyAi = args.includes('--only-ai')
  const onlyLegacy = args.includes('--only-legacy')

  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 10,
    dryRun,
    company,
    minQuality: Number.isFinite(minQuality) ? clampInt(minQuality, 0, 5) : 3,
    onlyAi,
    onlyLegacy,
  }
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

function safeParseJson(raw: string | null | undefined): any {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqLower(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of arr) {
    const v = (s || '').trim().toLowerCase()
    if (!v) continue
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function buildSnippet(summary?: string | null, bullets?: string[] | null): string | null {
  const base = (summary || '').trim()
  let s = base
  if (!s && bullets?.length) s = String(bullets[0] || '').trim()
  if (!s) return null
  if (s.length <= 160) return s
  return s.slice(0, 157).trimEnd() + '...'
}

// Simple, conservative quality heuristic (0–5)
// We do NOT “invent” content; we only score what we got back.
function scoreQuality(summary?: string | null, bullets?: string[] | null): number {
  const s = (summary || '').trim()
  const bCount = (bullets || []).filter(Boolean).length

  if (!s && bCount === 0) return 0
  if (s.length < 40 && bCount < 2) return 1
  if (s.length < 80 && bCount < 3) return 2
  if (s.length >= 80 && bCount >= 3) return 4
  return 3
}

/**
 * v2.9 safety: only write ai* fields if DB columns exist.
 * This prevents runtime failures before migrations are fixed.
 */
async function getJobColumnSet(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Job'
  `
  return new Set(rows.map((r) => r.column_name))
}

async function main() {
  const options = parseArgs()

  console.log(
    `🔎 Running AI annotation (limit=${options.limit}, dryRun=${options.dryRun}, company=${options.company ?? 'any'}, minQuality=${options.minQuality}, onlyAi=${options.onlyAi}, onlyLegacy=${options.onlyLegacy})`,
  )

  if (options.onlyAi && options.onlyLegacy) {
    console.error('❌ Invalid flags: --only-ai and --only-legacy cannot be used together.')
    process.exit(1)
  }

  // Detect if v2.9 columns exist
  let jobColumns: Set<string> | null = null
  try {
    jobColumns = await getJobColumnSet()
  } catch (e) {
    console.warn('⚠️ Could not read information_schema.columns. Continuing without v2.9 column detection.')
  }

  const hasAiColumns =
    !!jobColumns &&
    ['aiSummaryJson', 'aiSnippet', 'aiQualityScore', 'aiModel', 'aiVersion', 'lastAiEnrichedAt'].every((c) =>
      jobColumns!.has(c),
    )

  if (!hasAiColumns) {
    console.log('ℹ️ v2.9 ai* columns not detected in DB. This script will still run legacy enrichment safely.')
    console.log('   (Once migrations are fixed/applied, re-run to populate ai* fields.)')
  }

  // Pick jobs that need enrichment:
  // - legacy missing fields OR v2.9 missing aiQualityScore (if columns exist)
  const needsLegacyWhere = {
    OR: [{ techStack: null }, { experienceLevel: null }, { workArrangement: null }, { requirementsJson: null }],
  }

  // Note: Prisma "where" will fail if we reference aiQualityScore and column doesn't exist in client schema.
  // We only use aiQualityScore in the query if user has already generated prisma client with updated schema.
  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      descriptionHtml: { not: null },
      ...(options.company
        ? {
            companyRef: {
              slug: options.company,
            },
          }
        : {}),
      ...(options.onlyAi
        ? {} // don't filter by legacy needs
        : options.onlyLegacy
          ? needsLegacyWhere
          : needsLegacyWhere),
    },
    take: options.limit,
    orderBy: { createdAt: 'desc' },
    include: { companyRef: true },
  })

  if (!jobs.length) {
    console.log('No jobs found that need annotation.')
    return
  }

  const AI_MODEL = process.env.AI_MODEL ?? 'jobAnnotator'
  const AI_VERSION = process.env.AI_VERSION ?? 'v1'

  let updated = 0
  let aiWritten = 0
  let legacyWritten = 0

  for (const job of jobs) {
    const descriptionText = stripHtml(job.descriptionHtml ?? '').slice(0, 7000)

    try {
      const annotation = await annotateJobWithAI({
        title: job.title,
        description: descriptionText,
      })

      // Build legacy requirementsJson update
      const requirements = safeParseJson(job.requirementsJson)
      const newSummary = annotation.summary ?? requirements.summary ?? null
      const newBullets =
        annotation.bullets?.length > 0 ? annotation.bullets : Array.isArray(requirements.bullets) ? requirements.bullets : []

      const requirementsUpdated = {
        ...requirements,
        summary: newSummary,
        bullets: newBullets,
      }

      const data: any = {}

      // --------------------------
      // Legacy enrichment writes
      // --------------------------
      if (!options.onlyAi) {
        if (annotation.techStack?.length) {
          const stack = uniqLower(annotation.techStack)
          data.techStack = JSON.stringify(stack)
          data.skillsJson = JSON.stringify(stack)
        }

        if (annotation.keywords?.length) {
          // keep keywords as-is (already decided in your current script)
          data.skillsJson = JSON.stringify(annotation.keywords)
        }

        if (annotation.experienceLevel) {
          data.experienceLevel = annotation.experienceLevel
        }

        if (annotation.workArrangement) {
          data.workArrangement = annotation.workArrangement
        }

        if (typeof annotation.visaSponsorship === 'boolean') {
          data.visaSponsorship = annotation.visaSponsorship
        }

        data.requirementsJson = JSON.stringify(requirementsUpdated)
      }

      // --------------------------
      // v2.9 enrichment writes (only if columns exist AND schema/client supports it)
      // --------------------------
      if (!options.onlyLegacy && hasAiColumns) {
        const roleOverview = (annotation.summary ?? null) ? String(annotation.summary).trim() : null
        const responsibilities = Array.isArray(annotation.bullets) ? annotation.bullets.filter(Boolean) : []
        const qualityScore = scoreQuality(roleOverview, responsibilities)
        const snippet = buildSnippet(roleOverview, responsibilities)

        // Only write v2.9 AI fields if quality is acceptable
        if (qualityScore >= options.minQuality) {
          data.aiModel = AI_MODEL
          data.aiVersion = AI_VERSION
          data.lastAiEnrichedAt = new Date()
          data.aiQualityScore = qualityScore
          data.aiSnippet = snippet

          // Conservative structured JSON: only store what we actually have today.
          // We DO NOT invent requirements/benefits/whyHighPay until your annotator returns them.
          data.aiSummaryJson = {
            roleOverview,
            responsibilities,
            requirements: [],
            benefits: [],
            whyHighPay: null,
            jobCardSnippet: snippet,
            qualityScore,
          }

          aiWritten++
        }
      }

      const logContext = `${job.title} @ ${job.companyRef?.slug ?? job.company ?? 'unknown'}`
      const wroteSomething = Object.keys(data).length > 0

      if (!wroteSomething) {
        console.log(`⏭️  Skipped (no changes) ${logContext}`)
        continue
      }

      if (options.dryRun) {
        console.log(`➡️  [DRY RUN] Would update ${logContext}`, data)
        updated++
        if (!options.onlyAi) legacyWritten++
        continue
      }

      await prisma.job.update({
        where: { id: job.id },
        data,
      })

      // increment legacy count if we wrote any legacy keys
      if (!options.onlyAi) {
        const legacyKeys = ['techStack', 'skillsJson', 'experienceLevel', 'workArrangement', 'visaSponsorship', 'requirementsJson']
        if (legacyKeys.some((k) => k in data)) legacyWritten++
      }

      console.log(`✅ Annotated ${logContext}`)
      updated++
    } catch (err: any) {
      console.error(`❌ Failed to annotate job ${job.id} (${job.title}):`, err?.message || err)
    }
  }

  console.log(
    `\nDone. Updated ${updated} job(s). LegacyWrites=${legacyWritten}. AiWrites=${aiWritten}.`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
