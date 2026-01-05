import { prisma } from '../lib/prisma'

function pct(part: number, total: number) {
  if (!total) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

function nonEmptyString(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

async function main() {
  const sample = await prisma.job.findMany({
    where: { aiEnrichedAt: { not: null } },
    orderBy: { aiEnrichedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      title: true,
      company: true,
      companyRef: { select: { name: true } },
      aiOneLiner: true,
      aiSnippet: true,
      aiSummaryJson: true,
      techStack: true,
      skillsJson: true,
      aiEnrichedAt: true,
    },
  })

  const richSample = (await prisma.$queryRaw<
    Array<{
      id: string
      title: string
      company: string
      aiEnrichedAt: Date
      aiSummaryJson: unknown
      techStack: string | null
      skillsJson: string | null
    }>
  >`
    SELECT
      id,
      title,
      company,
      "aiEnrichedAt",
      "aiSummaryJson",
      "techStack",
      "skillsJson"
    FROM "Job"
    WHERE
      "aiEnrichedAt" IS NOT NULL
      AND "aiSummaryJson" IS NOT NULL
      AND ("aiSummaryJson" ? 'description')
      AND ("aiSummaryJson" ? 'requirements')
      AND ("aiSummaryJson" ? 'benefits')
    ORDER BY "aiEnrichedAt" DESC
    LIMIT 1;
  `)[0]

  const agg = await prisma.job.aggregate({
    where: { aiEnrichedAt: { not: null } },
    _count: {
      _all: true,
      aiOneLiner: true,
      aiSnippet: true,
      aiSummaryJson: true,
      techStack: true,
      skillsJson: true,
    },
  })

  const total = agg._count._all
  const counts = agg._count

  const jsonKeyStats = (await prisma.$queryRaw<
    Array<{
      total: number
      has_description_key: number
      has_requirements_key: number
      has_benefits_key: number
      description_nonempty: number
      requirements_nonempty: number
      benefits_nonempty: number
      bullets_nonempty: number
      only_bullets_object: number
    }>
  >`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "aiSummaryJson" IS NOT NULL AND ("aiSummaryJson" ? 'description'))::int AS has_description_key,
      COUNT(*) FILTER (WHERE "aiSummaryJson" IS NOT NULL AND ("aiSummaryJson" ? 'requirements'))::int AS has_requirements_key,
      COUNT(*) FILTER (WHERE "aiSummaryJson" IS NOT NULL AND ("aiSummaryJson" ? 'benefits'))::int AS has_benefits_key,
      COUNT(*) FILTER (
        WHERE "aiSummaryJson" IS NOT NULL
          AND jsonb_typeof("aiSummaryJson"->'description') = 'array'
          AND jsonb_array_length(COALESCE("aiSummaryJson"->'description', '[]'::jsonb)) > 0
      )::int AS description_nonempty,
      COUNT(*) FILTER (
        WHERE "aiSummaryJson" IS NOT NULL
          AND jsonb_typeof("aiSummaryJson"->'requirements') = 'array'
          AND jsonb_array_length(COALESCE("aiSummaryJson"->'requirements', '[]'::jsonb)) > 0
      )::int AS requirements_nonempty,
      COUNT(*) FILTER (
        WHERE "aiSummaryJson" IS NOT NULL
          AND jsonb_typeof("aiSummaryJson"->'benefits') = 'array'
          AND jsonb_array_length(COALESCE("aiSummaryJson"->'benefits', '[]'::jsonb)) > 0
      )::int AS benefits_nonempty,
      COUNT(*) FILTER (
        WHERE "aiSummaryJson" IS NOT NULL
          AND jsonb_typeof("aiSummaryJson"->'bullets') = 'array'
          AND jsonb_array_length(COALESCE("aiSummaryJson"->'bullets', '[]'::jsonb)) > 0
      )::int AS bullets_nonempty,
      COUNT(*) FILTER (
        WHERE "aiSummaryJson" IS NOT NULL
          AND NOT ("aiSummaryJson" ? 'description')
          AND NOT ("aiSummaryJson" ? 'requirements')
          AND NOT ("aiSummaryJson" ? 'benefits')
          AND ("aiSummaryJson" ? 'bullets')
      )::int AS only_bullets_object
    FROM "Job"
    WHERE "aiEnrichedAt" IS NOT NULL;
  `)[0]

  console.log('\n=== Sample (5 most recently enriched) ===')
  for (const j of sample) {
    const companyName = j.companyRef?.name || j.company
    console.log(`\n- id=${j.id}`)
    console.log(`  title=${j.title}`)
    console.log(`  company=${companyName}`)
    console.log(`  aiEnrichedAt=${j.aiEnrichedAt?.toISOString()}`)
    console.log(`  aiOneLiner=${j.aiOneLiner ? JSON.stringify(j.aiOneLiner) : 'null'}`)
    console.log(`  aiSnippet=${j.aiSnippet ? JSON.stringify(j.aiSnippet) : 'null'}`)
    console.log(`  techStack=${j.techStack ? j.techStack.slice(0, 160) + (j.techStack.length > 160 ? '…' : '') : 'null'}`)
    console.log(`  skillsJson=${j.skillsJson ? j.skillsJson.slice(0, 160) + (j.skillsJson.length > 160 ? '…' : '') : 'null'}`)
    console.log(`  aiSummaryJson=${j.aiSummaryJson ? JSON.stringify(j.aiSummaryJson) : 'null'}`)
  }

  if (richSample) {
    console.log('\n=== Sample (with full aiSummaryJson keys) ===')
    console.log(`id=${richSample.id}`)
    console.log(`title=${richSample.title}`)
    console.log(`company=${richSample.company}`)
    console.log(`aiEnrichedAt=${richSample.aiEnrichedAt?.toISOString?.() ?? String(richSample.aiEnrichedAt)}`)
    console.log(`techStack=${richSample.techStack ?? 'null'}`)
    console.log(`skillsJson=${richSample.skillsJson ?? 'null'}`)
    console.log(`aiSummaryJson=${JSON.stringify(richSample.aiSummaryJson)}`)
  }

  console.log('\n=== Coverage (aiEnrichedAt IS NOT NULL) ===')
  console.log(`total_enriched=${total}`)
  console.log(`has_oneliner=${counts.aiOneLiner} (${pct(counts.aiOneLiner, total)})`)
  console.log(`has_snippet=${counts.aiSnippet} (${pct(counts.aiSnippet, total)})`)
  console.log(`has_summary=${counts.aiSummaryJson} (${pct(counts.aiSummaryJson, total)})`)
  console.log(`has_techstack=${counts.techStack} (${pct(counts.techStack, total)})`)
  console.log(`has_skills=${counts.skillsJson} (${pct(counts.skillsJson, total)})`)

  console.log('\n=== aiSummaryJson Shape ===')
  console.log(`has description key=${jsonKeyStats.has_description_key} (${pct(jsonKeyStats.has_description_key, total)})`)
  console.log(`has requirements key=${jsonKeyStats.has_requirements_key} (${pct(jsonKeyStats.has_requirements_key, total)})`)
  console.log(`has benefits key=${jsonKeyStats.has_benefits_key} (${pct(jsonKeyStats.has_benefits_key, total)})`)
  console.log(`description nonempty=${jsonKeyStats.description_nonempty} (${pct(jsonKeyStats.description_nonempty, total)})`)
  console.log(`requirements nonempty=${jsonKeyStats.requirements_nonempty} (${pct(jsonKeyStats.requirements_nonempty, total)})`)
  console.log(`benefits nonempty=${jsonKeyStats.benefits_nonempty} (${pct(jsonKeyStats.benefits_nonempty, total)})`)
  console.log(`bullets nonempty=${jsonKeyStats.bullets_nonempty} (${pct(jsonKeyStats.bullets_nonempty, total)})`)
  console.log(`aiSummaryJson looks like {bullets} only=${jsonKeyStats.only_bullets_object} (${pct(jsonKeyStats.only_bullets_object, total)})`)

  // Extra quick quality check: empty-ish enrichments
  const emptyish = sample.filter(
    (j) =>
      !nonEmptyString(j.aiOneLiner) ||
      !nonEmptyString(j.aiSnippet) ||
      (j.aiSummaryJson &&
        typeof j.aiSummaryJson === 'object' &&
        j.aiSummaryJson !== null &&
        Array.isArray((j.aiSummaryJson as any).description) &&
        (j.aiSummaryJson as any).description.length === 0)
  )
  if (emptyish.length) {
    console.log(`\nNote: ${emptyish.length}/${sample.length} sampled rows look "thin" (missing one-liner/snippet or empty description array).`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
