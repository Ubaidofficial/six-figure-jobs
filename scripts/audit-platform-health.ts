import { prisma } from '../lib/prisma'

type Row = Record<string, any>

function fmtPct(part: number, total: number): string {
  if (!total) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

function mdTable(rows: Array<Record<string, any>>, columns: string[]): string {
  const header = `| ${columns.join(' | ')} |`
  const sep = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows
    .map((r) => `| ${columns.map((c) => String(r[c] ?? '')).join(' | ')} |`)
    .join('\n')
  return [header, sep, body].filter(Boolean).join('\n')
}

async function one<T extends Row>(q: TemplateStringsArray): Promise<T> {
  const rows = await prisma.$queryRaw<T[]>(q)
  return rows[0] as T
}

async function many<T extends Row>(q: TemplateStringsArray): Promise<T[]> {
  return prisma.$queryRaw<T[]>(q)
}

async function main() {
  const now = new Date()
  const stamp = now.toISOString()

  const jobs = await one<{
    jobs_total: number
    jobs_active: number
    jobs_expired: number
  }>`
    SELECT
      COUNT(*)::int AS jobs_total,
      COUNT(*) FILTER (WHERE "isExpired" = false)::int AS jobs_active,
      COUNT(*) FILTER (WHERE "isExpired" = true)::int AS jobs_expired
    FROM "Job";
  `

  const activeQuality = await one<{
    total_active: number
    null_role: number
    null_salary: number
    null_minAnnual: number
    null_location: number
    thin_content: number
    null_companyId: number
    null_companyText: number
    null_source: number
    validated: number
  }>`
    SELECT
      COUNT(*)::int AS "total_active",
      COUNT(*) FILTER (WHERE "roleSlug" IS NULL OR "roleSlug" = '')::int AS "null_role",
      COUNT(*) FILTER (WHERE ("salaryMin" IS NULL AND "salaryMax" IS NULL AND "minAnnual" IS NULL AND "maxAnnual" IS NULL))::int AS "null_salary",
      COUNT(*) FILTER (WHERE "minAnnual" IS NULL AND "maxAnnual" IS NULL)::int AS "null_minAnnual",
      COUNT(*) FILTER (WHERE "locationRaw" IS NULL OR "locationRaw" = '')::int AS "null_location",
      COUNT(*) FILTER (WHERE COALESCE(LENGTH("descriptionHtml"),0) < 100)::int AS "thin_content",
      COUNT(*) FILTER (WHERE "companyId" IS NULL)::int AS "null_companyId",
      COUNT(*) FILTER (WHERE "company" IS NULL OR "company" = '')::int AS "null_companyText",
      COUNT(*) FILTER (WHERE "source" IS NULL OR "source" = '')::int AS "null_source",
      COUNT(*) FILTER (WHERE "salaryValidated" = true)::int AS "validated"
    FROM "Job"
    WHERE "isExpired" = false;
  `

  const salaryOutliers = await many<{
    id: string
    title: string
    company: string
    currency: string | null
    minAnnual: string | null
    maxAnnual: string | null
    salaryMin: string | null
    salaryMax: string | null
  }>`
    SELECT
      id,
      COALESCE(title,'') AS title,
      COALESCE(company,'') AS company,
      COALESCE("currency","salaryCurrency") AS currency,
      CASE WHEN "minAnnual" IS NULL THEN NULL ELSE ("minAnnual"::text) END AS "minAnnual",
      CASE WHEN "maxAnnual" IS NULL THEN NULL ELSE ("maxAnnual"::text) END AS "maxAnnual",
      CASE WHEN "salaryMin" IS NULL THEN NULL ELSE ("salaryMin"::text) END AS "salaryMin",
      CASE WHEN "salaryMax" IS NULL THEN NULL ELSE ("salaryMax"::text) END AS "salaryMax"
    FROM "Job"
    WHERE
      "isExpired" = false
      AND (
        ("minAnnual" IS NOT NULL AND "minAnnual" > 2000000)
        OR ("maxAnnual" IS NOT NULL AND "maxAnnual" > 2000000)
        OR ("salaryMin" IS NOT NULL AND "salaryMin" > 2000000)
        OR ("salaryMax" IS NOT NULL AND "salaryMax" > 2000000)
      )
    ORDER BY COALESCE("maxAnnual","minAnnual","salaryMax","salaryMin") DESC NULLS LAST
    LIMIT 20;
  `

  const salaryOutlierCount = await one<{ outlier_count: number }>`
    SELECT COUNT(*)::int AS outlier_count
    FROM "Job"
    WHERE
      "isExpired" = false
      AND (
        ("minAnnual" IS NOT NULL AND "minAnnual" > 2000000)
        OR ("maxAnnual" IS NOT NULL AND "maxAnnual" > 2000000)
        OR ("salaryMin" IS NOT NULL AND "salaryMin" > 2000000)
        OR ("salaryMax" IS NOT NULL AND "salaryMax" > 2000000)
      );
  `

  const currencyDist = await many<{ currency: string; jobs: number; validated: number }>`
    SELECT
      COALESCE(NULLIF("currency",''), 'NULL') AS currency,
      COUNT(*)::int AS jobs,
      COUNT(*) FILTER (WHERE "salaryValidated" = true)::int AS validated
    FROM "Job"
    WHERE "isExpired" = false
    GROUP BY 1
    ORDER BY jobs DESC
    LIMIT 20;
  `

  const ageBuckets = await one<{
    active_0_7d: number
    active_8_30d: number
    active_31_90d: number
    active_90d_plus: number
  }>`
    SELECT
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days')::int AS active_0_7d,
      COUNT(*) FILTER (WHERE "createdAt" < NOW() - INTERVAL '7 days' AND "createdAt" >= NOW() - INTERVAL '30 days')::int AS active_8_30d,
      COUNT(*) FILTER (WHERE "createdAt" < NOW() - INTERVAL '30 days' AND "createdAt" >= NOW() - INTERVAL '90 days')::int AS active_31_90d,
      COUNT(*) FILTER (WHERE "createdAt" < NOW() - INTERVAL '90 days')::int AS active_90d_plus
    FROM "Job"
    WHERE "isExpired" = false;
  `

  const roleDist = await many<{ roleSlug: string; jobs: number }>`
    SELECT
      COALESCE(NULLIF("roleSlug",''), 'NULL') AS "roleSlug",
      COUNT(*)::int AS jobs
    FROM "Job"
    WHERE "isExpired" = false
    GROUP BY 1
    ORDER BY jobs DESC
    LIMIT 25;
  `

  const companyDupes = await many<{ key: string; dupes: number }>`
    SELECT LOWER(TRIM(name)) AS key, COUNT(*)::int AS dupes
    FROM "Company"
    WHERE name IS NOT NULL AND TRIM(name) <> ''
    GROUP BY 1
    HAVING COUNT(*) > 1
    ORDER BY dupes DESC, key ASC
    LIMIT 20;
  `

  const companyOrphans = await one<{ orphan_companies: number }>`
    SELECT COUNT(*)::int AS orphan_companies
    FROM "Company" c
    LEFT JOIN "Job" j ON j."companyId" = c.id
    WHERE j.id IS NULL;
  `

  const sourceDist7d = await many<{ source: string; created_7d: number }>`
    SELECT
      COALESCE(NULLIF("source",''), 'NULL') AS source,
      COUNT(*)::int AS created_7d
    FROM "Job"
    WHERE "createdAt" >= NOW() - INTERVAL '7 days'
    GROUP BY 1
    ORDER BY created_7d DESC
    LIMIT 25;
  `

  const atsProviders = await many<{
    atsProvider: string
    companies: number
    success: number
    failed: number
    never_scraped: number
  }>`
    SELECT
      COALESCE(NULLIF("atsProvider",''), 'NULL') AS "atsProvider",
      COUNT(*)::int AS companies,
      COUNT(*) FILTER (WHERE "scrapeStatus" = 'success')::int AS success,
      COUNT(*) FILTER (WHERE "scrapeStatus" = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE "lastScrapedAt" IS NULL)::int AS never_scraped
    FROM "Company"
    WHERE "atsProvider" IS NOT NULL
    GROUP BY 1
    ORDER BY companies DESC;
  `

  const atsFailures = await many<{
    id: string
    name: string
    atsProvider: string | null
    atsUrl: string | null
    lastScrapedAt: Date | null
    scrapeError: string | null
  }>`
    SELECT
      id,
      COALESCE(name,'') AS name,
      "atsProvider",
      "atsUrl",
      "lastScrapedAt",
      "scrapeError"
    FROM "Company"
    WHERE "atsProvider" IS NOT NULL AND "scrapeStatus" = 'failed'
    ORDER BY "lastScrapedAt" DESC NULLS LAST
    LIMIT 15;
  `

  const aiCoverageActive = await one<{
    active: number
    enriched: number
    has_oneliner: number
    has_snippet: number
    has_summary: number
    has_techstack: number
    has_skills: number
  }>`
    SELECT
      COUNT(*)::int AS active,
      COUNT(*) FILTER (WHERE "aiEnrichedAt" IS NOT NULL)::int AS enriched,
      COUNT(*) FILTER (WHERE "aiOneLiner" IS NOT NULL AND LENGTH(TRIM("aiOneLiner")) > 0)::int AS has_oneliner,
      COUNT(*) FILTER (WHERE "aiSnippet" IS NOT NULL AND LENGTH(TRIM("aiSnippet")) > 0)::int AS has_snippet,
      COUNT(*) FILTER (WHERE "aiSummaryJson" IS NOT NULL)::int AS has_summary,
      COUNT(*) FILTER (WHERE "techStack" IS NOT NULL AND LENGTH(TRIM("techStack")) > 0)::int AS has_techstack,
      COUNT(*) FILTER (WHERE "skillsJson" IS NOT NULL AND LENGTH(TRIM("skillsJson")) > 0)::int AS has_skills
    FROM "Job"
    WHERE "isExpired" = false;
  `

  const aiSummaryShape = await one<{
    enriched: number
    full_keys: number
    bullets_only: number
    benefits_nonempty: number
  }>`
    SELECT
      COUNT(*) FILTER (WHERE "aiEnrichedAt" IS NOT NULL)::int AS enriched,
      COUNT(*) FILTER (
        WHERE "aiEnrichedAt" IS NOT NULL
          AND "aiSummaryJson" IS NOT NULL
          AND ("aiSummaryJson" ? 'description')
          AND ("aiSummaryJson" ? 'requirements')
          AND ("aiSummaryJson" ? 'benefits')
      )::int AS full_keys,
      COUNT(*) FILTER (
        WHERE "aiEnrichedAt" IS NOT NULL
          AND "aiSummaryJson" IS NOT NULL
          AND ("aiSummaryJson" ? 'bullets')
          AND NOT ("aiSummaryJson" ? 'description')
          AND NOT ("aiSummaryJson" ? 'requirements')
          AND NOT ("aiSummaryJson" ? 'benefits')
      )::int AS bullets_only,
      COUNT(*) FILTER (
        WHERE "aiEnrichedAt" IS NOT NULL
          AND "aiSummaryJson" IS NOT NULL
          AND jsonb_typeof("aiSummaryJson"->'benefits') = 'array'
          AND jsonb_array_length(COALESCE("aiSummaryJson"->'benefits', '[]'::jsonb)) > 0
      )::int AS benefits_nonempty
    FROM "Job";
  `

  const aiEnrichedPerDay = await many<{ day: string; enriched: number }>`
    SELECT
      to_char(date_trunc('day', "aiEnrichedAt"), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS enriched
    FROM "Job"
    WHERE "aiEnrichedAt" >= NOW() - INTERVAL '14 days'
    GROUP BY 1
    ORDER BY day DESC;
  `

  const aiLedger7d = await one<{ days: number; jobs: number; tokens_in: number; tokens_out: number }>`
    SELECT
      COUNT(*)::int AS days,
      SUM("jobsProcessed")::int AS jobs,
      SUM("tokensIn")::int AS tokens_in,
      SUM("tokensOut")::int AS tokens_out
    FROM "AiRunLedger"
    WHERE day >= (NOW() - INTERVAL '7 days');
  `

  const aiLedger30d = await one<{ days: number; jobs: number; tokens_in: number; tokens_out: number }>`
    SELECT
      COUNT(*)::int AS days,
      SUM("jobsProcessed")::int AS jobs,
      SUM("tokensIn")::int AS tokens_in,
      SUM("tokensOut")::int AS tokens_out
    FROM "AiRunLedger"
    WHERE day >= (NOW() - INTERVAL '30 days');
  `

  const aiLedgerRecent = await many<{ day: string; jobs: number; tokens_total: number }>`
    SELECT
      to_char(day, 'YYYY-MM-DD') AS day,
      "jobsProcessed"::int AS jobs,
      ("tokensIn" + "tokensOut")::int AS tokens_total
    FROM "AiRunLedger"
    ORDER BY day DESC
    LIMIT 14;
  `

  const tableSizes = await many<{ table: string; total: string; indexes: string }>`
    SELECT
      c.relname AS table,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS total,
      pg_size_pretty(pg_indexes_size(c.oid)) AS indexes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN ('Job', 'Company', 'Location', 'AiRunLedger')
    ORDER BY pg_total_relation_size(c.oid) DESC;
  `

  // Markdown report
  const lines: string[] = []
  lines.push(`# Six Figure Jobs — Platform Health Audit`)
  lines.push(`Generated: ${stamp}`)
  lines.push('')

  lines.push(`## Summary Metrics`)
  lines.push(
    mdTable(
      [
        {
          metric: 'Jobs (total)',
          value: jobs.jobs_total,
        },
        { metric: 'Jobs (active)', value: jobs.jobs_active },
        { metric: 'Jobs (expired)', value: jobs.jobs_expired },
      ],
      ['metric', 'value'],
    ),
  )
  lines.push('')

  lines.push(`## Database Size (Postgres)`)
  if (tableSizes.length) {
    lines.push(mdTable(tableSizes, ['table', 'total', 'indexes']))
  } else {
    lines.push('(no rows)')
  }
  lines.push('')

  lines.push(`## Data Quality (Active Jobs)`)
  lines.push(
    mdTable(
      [
        { metric: 'Active jobs', value: activeQuality.total_active },
        { metric: 'Null roleSlug', value: `${activeQuality.null_role} (${fmtPct(activeQuality.null_role, activeQuality.total_active)})` },
        { metric: 'No salary fields (salary*/minAnnual/maxAnnual)', value: `${activeQuality.null_salary} (${fmtPct(activeQuality.null_salary, activeQuality.total_active)})` },
        { metric: 'No normalized salary (minAnnual/maxAnnual)', value: `${activeQuality.null_minAnnual} (${fmtPct(activeQuality.null_minAnnual, activeQuality.total_active)})` },
        { metric: 'Null/empty locationRaw', value: `${activeQuality.null_location} (${fmtPct(activeQuality.null_location, activeQuality.total_active)})` },
        { metric: 'Thin content (<100 chars descriptionHtml)', value: `${activeQuality.thin_content} (${fmtPct(activeQuality.thin_content, activeQuality.total_active)})` },
        { metric: 'Null companyId', value: `${activeQuality.null_companyId} (${fmtPct(activeQuality.null_companyId, activeQuality.total_active)})` },
        { metric: 'Null/empty company text', value: `${activeQuality.null_companyText} (${fmtPct(activeQuality.null_companyText, activeQuality.total_active)})` },
        { metric: 'Null/empty source', value: `${activeQuality.null_source} (${fmtPct(activeQuality.null_source, activeQuality.total_active)})` },
        { metric: 'Salary validated', value: `${activeQuality.validated} (${fmtPct(activeQuality.validated, activeQuality.total_active)})` },
      ],
      ['metric', 'value'],
    ),
  )
  lines.push('')

  lines.push(`## Salary Health`)
  lines.push(`- Outliers (> $2M/yr equivalents): ${salaryOutlierCount.outlier_count}`)
  if (salaryOutliers.length) {
    lines.push('')
    lines.push(mdTable(salaryOutliers, ['id', 'title', 'company', 'currency', 'minAnnual', 'maxAnnual', 'salaryMin', 'salaryMax']))
  }
  lines.push('')
  lines.push(`### Currency Distribution (Active)`)
  lines.push(mdTable(currencyDist, ['currency', 'jobs', 'validated']))
  lines.push('')

  lines.push(`## Freshness (Active Jobs by createdAt)`)
  lines.push(
    mdTable(
      [
        { bucket: '0–7d', jobs: ageBuckets.active_0_7d },
        { bucket: '8–30d', jobs: ageBuckets.active_8_30d },
        { bucket: '31–90d', jobs: ageBuckets.active_31_90d },
        { bucket: '90d+', jobs: ageBuckets.active_90d_plus },
      ],
      ['bucket', 'jobs'],
    ),
  )
  lines.push('')

  lines.push(`## Roles (Active, Top 25)`)
  lines.push(mdTable(roleDist, ['roleSlug', 'jobs']))
  lines.push('')

  lines.push(`## Company Integrity`)
  lines.push(`- Orphan companies (0 jobs): ${companyOrphans.orphan_companies}`)
  lines.push(`- Duplicate company name groups (case-insensitive): ${companyDupes.length} shown`)
  if (companyDupes.length) {
    lines.push('')
    lines.push(mdTable(companyDupes, ['key', 'dupes']))
  }
  lines.push('')

  lines.push(`## Scrapers / Sources (Created in last 7d, Top 25)`)
  lines.push(mdTable(sourceDist7d, ['source', 'created_7d']))
  lines.push('')

  lines.push(`## ATS Health (Companies with atsProvider)`)
  lines.push(mdTable(atsProviders, ['atsProvider', 'companies', 'success', 'failed', 'never_scraped']))
  if (atsFailures.length) {
    lines.push('')
    lines.push(`### Recent ATS Failures (Top 15)`)
    lines.push(
      mdTable(
        atsFailures.map((r) => ({
          id: r.id,
          name: r.name,
          atsProvider: r.atsProvider ?? '',
          lastScrapedAt: r.lastScrapedAt ? new Date(r.lastScrapedAt).toISOString() : '',
          scrapeError: (r.scrapeError || '').slice(0, 120),
        })),
        ['id', 'name', 'atsProvider', 'lastScrapedAt', 'scrapeError'],
      ),
    )
  }
  lines.push('')

  lines.push(`## AI Enrichment (Active Jobs)`)
  lines.push(
    mdTable(
      [
        { metric: 'Active jobs', value: aiCoverageActive.active },
        { metric: 'AI enriched', value: `${aiCoverageActive.enriched} (${fmtPct(aiCoverageActive.enriched, aiCoverageActive.active)})` },
        { metric: 'Has aiOneLiner', value: `${aiCoverageActive.has_oneliner} (${fmtPct(aiCoverageActive.has_oneliner, aiCoverageActive.active)})` },
        { metric: 'Has aiSnippet', value: `${aiCoverageActive.has_snippet} (${fmtPct(aiCoverageActive.has_snippet, aiCoverageActive.active)})` },
        { metric: 'Has aiSummaryJson', value: `${aiCoverageActive.has_summary} (${fmtPct(aiCoverageActive.has_summary, aiCoverageActive.active)})` },
        { metric: 'Has techStack', value: `${aiCoverageActive.has_techstack} (${fmtPct(aiCoverageActive.has_techstack, aiCoverageActive.active)})` },
        { metric: 'Has skillsJson', value: `${aiCoverageActive.has_skills} (${fmtPct(aiCoverageActive.has_skills, aiCoverageActive.active)})` },
      ],
      ['metric', 'value'],
    ),
  )
  lines.push('')
  lines.push(
    mdTable(
      [
        { metric: 'Enriched (all time)', value: aiSummaryShape.enriched },
        { metric: 'aiSummaryJson has full keys', value: `${aiSummaryShape.full_keys} (${fmtPct(aiSummaryShape.full_keys, aiSummaryShape.enriched)})` },
        { metric: 'aiSummaryJson bullets-only', value: `${aiSummaryShape.bullets_only} (${fmtPct(aiSummaryShape.bullets_only, aiSummaryShape.enriched)})` },
        { metric: 'benefits non-empty', value: `${aiSummaryShape.benefits_nonempty} (${fmtPct(aiSummaryShape.benefits_nonempty, aiSummaryShape.enriched)})` },
      ],
      ['metric', 'value'],
    ),
  )
  lines.push('')

  lines.push(`### AI Enrichment Rate (last 14d)`)
  if (aiEnrichedPerDay.length) lines.push(mdTable(aiEnrichedPerDay, ['day', 'enriched']))
  else lines.push(`(no rows)`)
  lines.push('')

  lines.push(`### AI Token Ledger`)
  lines.push(
    mdTable(
      [
        {
          window: '7d',
          days: aiLedger7d.days,
          jobs: aiLedger7d.jobs || 0,
          tokens_in: aiLedger7d.tokens_in || 0,
          tokens_out: aiLedger7d.tokens_out || 0,
          tokens_per_job:
            aiLedger7d.jobs ? Math.round(((aiLedger7d.tokens_in || 0) + (aiLedger7d.tokens_out || 0)) / aiLedger7d.jobs) : 0,
        },
        {
          window: '30d',
          days: aiLedger30d.days,
          jobs: aiLedger30d.jobs || 0,
          tokens_in: aiLedger30d.tokens_in || 0,
          tokens_out: aiLedger30d.tokens_out || 0,
          tokens_per_job:
            aiLedger30d.jobs ? Math.round(((aiLedger30d.tokens_in || 0) + (aiLedger30d.tokens_out || 0)) / aiLedger30d.jobs) : 0,
        },
      ],
      ['window', 'days', 'jobs', 'tokens_in', 'tokens_out', 'tokens_per_job'],
    ),
  )
  lines.push('')
  if (aiLedgerRecent.length) {
    lines.push(`#### Recent days (top 14)`)
    lines.push(mdTable(aiLedgerRecent, ['day', 'jobs', 'tokens_total']))
    lines.push('')
  }

  process.stdout.write(lines.join('\n') + '\n')
}

main()
  .catch((e) => {
    console.error('[audit] failed:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
