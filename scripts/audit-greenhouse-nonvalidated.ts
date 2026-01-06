/**
 * Deep dive: why Greenhouse jobs are non-validated.
 *
 * Produces:
 *  - Counts of Greenhouse jobs by salaryParseReason
 *  - Random samples per reason (default 5)
 *  - Heuristics about whether the Greenhouse pay-range markup exists in descriptionHtml
 *
 * Usage:
 *   dotenv -f .env run -- npx tsx scripts/audit-greenhouse-nonvalidated.ts
 *   dotenv -f .env run -- npx tsx scripts/audit-greenhouse-nonvalidated.ts --per-reason 20
 */

import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'

type Row = Record<string, any>

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')

function getArg(name: string): string | null {
  const args = process.argv.slice(2)
  const idx = args.indexOf(name)
  if (idx === -1) return null
  return args[idx + 1] ?? null
}

function mdTable(rows: Array<Record<string, any>>, columns: string[]): string {
  const header = `| ${columns.join(' | ')} |`
  const sep = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows
    .map((r) => `| ${columns.map((c) => String(r[c] ?? '')).join(' | ')} |`)
    .join('\n')
  return [header, sep, body].filter(Boolean).join('\n')
}

function clip(s: unknown, max = 140): string {
  if (typeof s !== 'string') return ''
  const oneLine = s.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, max - 1)}…`
}

async function many<T extends Row>(q: TemplateStringsArray, ...vals: any[]): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return prisma.$queryRaw<T[]>(q, ...vals)
}

async function one<T extends Row>(q: TemplateStringsArray, ...vals: any[]): Promise<T> {
  const rows = await many<T>(q, ...vals)
  return rows[0] as T
}

async function main() {
  const perReason = Number(getArg('--per-reason') ?? '5') || 5

  const totals = await one<{
    greenhouse_active_total: number
    greenhouse_active_validated: number
    greenhouse_active_nonvalidated: number
  }>`
    SELECT
      COUNT(*) FILTER (WHERE "isExpired" = false)::int AS greenhouse_active_total,
      COUNT(*) FILTER (WHERE "isExpired" = false AND "salaryValidated" = true)::int AS greenhouse_active_validated,
      COUNT(*) FILTER (WHERE "isExpired" = false AND "salaryValidated" = false)::int AS greenhouse_active_nonvalidated
    FROM "Job"
    WHERE "source" = 'ats:greenhouse';
  `

  __slog('**Greenhouse Validation Coverage (active jobs)**')
  __slog(`- Total greenhouse active: ${totals.greenhouse_active_total}`)
  __slog(`- salaryValidated=true: ${totals.greenhouse_active_validated}`)
  __slog(`- salaryValidated=false: ${totals.greenhouse_active_nonvalidated}`)
  __slog('')

  const reasonCounts = await many<{
    salaryParseReason: string | null
    count: number
  }>`
    SELECT
      "salaryParseReason"::text AS "salaryParseReason",
      COUNT(*)::int AS "count"
    FROM "Job"
    WHERE
      "source" = 'ats:greenhouse'
      AND "isExpired" = false
      AND "salaryValidated" = false
    GROUP BY "salaryParseReason"
    ORDER BY COUNT(*) DESC;
  `

  __slog('**Greenhouse Non-Validated Reasons (active jobs)**')
  __slog(mdTable(reasonCounts, ['salaryParseReason', 'count']))
  __slog('')

  const reasonsToSample = ['unknown_currency', 'below_threshold', 'bad_range', 'too_high']

  for (const reason of reasonsToSample) {
    const rows = await many<{
      id: string
      title: string
      company: string
      salaryRaw: string | null
      salaryMin: string | null
      salaryMax: string | null
      salaryCurrency: string | null
      salaryParseReason: string | null
      descriptionHtml: string | null
    }>`
      SELECT
        "id",
        "title",
        "company",
        "salaryRaw",
        "salaryMin"::text AS "salaryMin",
        "salaryMax"::text AS "salaryMax",
        "salaryCurrency",
        "salaryParseReason",
        "descriptionHtml"
      FROM "Job"
      WHERE
        "source" = 'ats:greenhouse'
        AND "isExpired" = false
        AND "salaryValidated" = false
        AND COALESCE("salaryParseReason",'') = ${reason}
      ORDER BY RANDOM()
      LIMIT ${perReason};
    `

    const mapped = rows.map((r) => {
      const html = r.descriptionHtml ?? ''
      const hasPayRange = /pay-range/i.test(html) || /pay\s*range/i.test(html)
      const hasUsdCode = /\bUSD\b/i.test(html)
      const hasDollar = /\$/i.test(html)

      let issue = ''
      if (reason === 'unknown_currency') {
        if (!r.salaryCurrency && hasDollar && !hasUsdCode) issue = 'Salary uses $ without USD code; parser can’t infer currency'
        else if (!hasPayRange) issue = 'Greenhouse pay-range markup not found; fallback text parsing'
        else issue = 'Parser missed currency code/symbol mapping'
      } else if (reason === 'below_threshold') {
        issue = 'Parsed pay is below high-salary threshold (or interval misread as annual)'
      } else if (reason === 'bad_range') {
        issue = 'No parseable salary in content (or invalid min/max)'
      } else if (reason === 'too_high') {
        issue = 'Parsed salary exceeds currency cap (likely description contamination)'
      }

      return {
        id: r.id,
        title: clip(r.title, 60),
        company: clip(r.company, 40),
        salaryRaw: clip(r.salaryRaw, 80),
        salaryMin: r.salaryMin ?? '',
        salaryMax: r.salaryMax ?? '',
        salaryCurrency: r.salaryCurrency ?? '',
        salaryParseReason: r.salaryParseReason ?? '',
        issue,
        hasPayRange: String(hasPayRange),
      }
    })

    __slog(`**Sample Analysis (${Math.min(perReason, mapped.length)} jobs) — ${reason}**`)
    __slog(
      mdTable(mapped, [
        'id',
        'title',
        'company',
        'salaryRaw',
        'salaryMin',
        'salaryMax',
        'salaryCurrency',
        'salaryParseReason',
        'hasPayRange',
        'issue',
      ]),
    )
    __slog('')
  }
}

main().catch((err) => {
  __slog(String(err?.stack || err))
  process.exitCode = 1
})

