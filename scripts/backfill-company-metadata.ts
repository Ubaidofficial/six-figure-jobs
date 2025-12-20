// scripts/backfill-company-metadata.ts
// Usage:
//   npx tsx scripts/backfill-company-metadata.ts --limit 100
//   npx tsx scripts/backfill-company-metadata.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { enrichCompanyWithAI } from '../lib/ai/companyEnricher'

const prisma = new PrismaClient()

type Args = {
  dryRun: boolean
  limit: number | null
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, limit: null }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') {
      args.dryRun = true
      continue
    }
    if (a === '--limit') {
      const raw = argv[i + 1]
      i++
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) args.limit = Math.trunc(n)
      continue
    }
    if (a.startsWith('--limit=')) {
      const raw = a.split('=')[1]
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) args.limit = Math.trunc(n)
      continue
    }
  }

  return args
}

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseTagsJson(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? (parsed as unknown[]).filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

function mergeBenefitTags(existing: string[], benefits: {
  healthInsurance: boolean
  retirement401k: boolean
  equity: boolean
  unlimited_pto: boolean
}): string[] {
  const add: string[] = []
  if (benefits.healthInsurance) add.push('benefit:health-insurance')
  if (benefits.retirement401k) add.push('benefit:401k')
  if (benefits.equity) add.push('benefit:equity')
  if (benefits.unlimited_pto) add.push('benefit:unlimited-pto')

  if (!add.length) return existing

  const seen = new Set(existing)
  const out = [...existing]
  for (const t of add) {
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

async function main() {
  const { dryRun, limit } = parseArgs(process.argv.slice(2))

  console.log(`🏢 Backfill company metadata (dryRun=${dryRun}${limit ? `, limit=${limit}` : ''})`)

  const companies = await prisma.company.findMany({
    where: {
      OR: [{ sizeBucket: null }, { industry: null }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sizeBucket: true,
      industry: true,
      tagsJson: true,
    },
    orderBy: { updatedAt: 'asc' },
    ...(limit ? { take: limit } : {}),
  })

  console.log(`Found ${companies.length.toLocaleString()} companies missing size/industry.`)
  if (!companies.length) return

  let processed = 0
  let updated = 0
  let skippedNoJob = 0
  let skippedNoChanges = 0
  let failed = 0

  for (const company of companies) {
    processed++

    try {
      const job = await prisma.job.findFirst({
        where: {
          companyId: company.id,
          isExpired: false,
          descriptionHtml: { not: null },
        },
        orderBy: [{ postedAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          title: true,
          descriptionHtml: true,
        },
      })

      if (!job?.descriptionHtml) {
        skippedNoJob++
        continue
      }

      // Rate limit between DeepSeek calls
      await sleep(250)

      const description = stripHtml(job.descriptionHtml).slice(0, 7000)
      const enrichment = await enrichCompanyWithAI({
        companyName: company.name,
        jobTitle: job.title,
        jobDescription: description,
      })

      const nextSize = company.sizeBucket ?? enrichment.size
      const nextIndustry = company.industry ?? enrichment.industry

      const existingTags = parseTagsJson(company.tagsJson)
      const nextTags = mergeBenefitTags(existingTags, enrichment.benefits)
      const nextTagsJson = nextTags.length ? JSON.stringify(nextTags) : null

      const willChange =
        (company.sizeBucket ?? null) !== (nextSize ?? null) ||
        (company.industry ?? null) !== (nextIndustry ?? null) ||
        (company.tagsJson ?? null) !== (nextTagsJson ?? null)

      if (!willChange) {
        skippedNoChanges++
        continue
      }

      if (dryRun) {
        console.log(
          `➡️ [DRY RUN] ${company.name} (${company.slug}) size=${company.sizeBucket ?? '∅'}→${nextSize ?? '∅'} industry=${company.industry ?? '∅'}→${nextIndustry ?? '∅'} tags+benefits=${nextTags.length}`,
        )
        updated++
      } else {
        await prisma.$transaction(async (tx) => {
          // Re-check inside transaction to avoid overwriting concurrently-updated records.
          const current = await tx.company.findUnique({
            where: { id: company.id },
            select: { sizeBucket: true, industry: true, tagsJson: true },
          })
          if (!current) return

          const data: Record<string, any> = {}
          if (!current.sizeBucket && nextSize) data.sizeBucket = nextSize
          if (!current.industry && nextIndustry) data.industry = nextIndustry
          if ((current.tagsJson ?? null) !== (nextTagsJson ?? null)) data.tagsJson = nextTagsJson

          if (Object.keys(data).length === 0) return

          await tx.company.update({
            where: { id: company.id },
            data,
          })
        })

        updated++
      }
    } catch (err: any) {
      failed++
      console.error(`❌ ${company.name} (${company.slug}): ${err?.message || err}`)
    }

    if (processed % 10 === 0) {
      console.log(
        `[progress] processed=${processed}/${companies.length} updated=${updated} skippedNoJob=${skippedNoJob} skippedNoChanges=${skippedNoChanges} failed=${failed}`,
      )
    }
  }

  console.log(
    `Done. processed=${processed} updated=${updated} skippedNoJob=${skippedNoJob} skippedNoChanges=${skippedNoChanges} failed=${failed}`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

