/**
 * Backfill Greenhouse salaries for non-validated jobs by re-parsing descriptionHtml
 * using the enhanced Greenhouse salary parser.
 *
 * Usage:
 *   dotenv -f .env run -- npx tsx scripts/backfill-greenhouse-salaries.ts
 *   dotenv -f .env run -- npx tsx scripts/backfill-greenhouse-salaries.ts --apply
 *   dotenv -f .env run -- npx tsx scripts/backfill-greenhouse-salaries.ts --limit 200
 */

import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'
import { parseGreenhouseSalary } from '../lib/ingest/greenhouseSalaryParser'
import {
  normalizeSalary,
  validateHighSalaryEligibility,
} from '../lib/normalizers/salary'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

function getArg(name: string): string | null {
  const args = process.argv.slice(2)
  const idx = args.indexOf(name)
  if (idx === -1) return null
  return args[idx + 1] ?? null
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name)
}

async function main() {
  const apply = hasFlag('--apply')
  const limit = Number(getArg('--limit') ?? '') || null
  const logRaw = getArg('--log')
  const logLimit =
    logRaw == null ? 25 : Math.max(0, Number.isFinite(Number(logRaw)) ? Number(logRaw) : 0)

  __slog('🔁 Backfill Greenhouse salaries')
  __slog(`   Mode : ${apply ? 'APPLY (writes)' : 'dry-run'}`)
  __slog(`   Limit: ${limit ?? 'none'}`)
  __slog(`   Log  : ${logLimit} validations`)
  __slog('')

  const jobs = await prisma.job.findMany({
    where: {
      source: 'ats:greenhouse',
      isExpired: false,
      salaryValidated: false,
    },
    take: limit ?? undefined,
    select: {
      id: true,
      title: true,
      company: true,
      locationRaw: true,
      countryCode: true,
      descriptionHtml: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      salaryPeriod: true,
      salaryParseReason: true,
      salaryValidated: true,
      salaryRaw: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  __slog(`Loaded ${jobs.length} non-validated Greenhouse jobs`)
  if (jobs.length === 0) return

  let parsedCount = 0
  let wouldValidate = 0
  let updated = 0
  let logged = 0
  const reasonCounts: Record<string, number> = {}

  for (const job of jobs) {
    const parsed = parseGreenhouseSalary({
      html: job.descriptionHtml,
      locationText: job.locationRaw ?? null,
      countryCode: job.countryCode ?? null,
    })

    if (!parsed) continue
    parsedCount++

    const normalized = normalizeSalary({
      min: parsed.min,
      max: parsed.max,
      currency: parsed.currency,
      interval: parsed.interval ?? 'year',
    })

    const validation = validateHighSalaryEligibility({
      normalized,
      source: 'descriptionText',
      currencyAmbiguous: parsed.currency == null,
      now: new Date(),
      title: job.title,
    })

    reasonCounts[validation.salaryParseReason] = (reasonCounts[validation.salaryParseReason] ?? 0) + 1

    if (validation.salaryValidated !== true) continue
    wouldValidate++

    if (!apply) {
      if (logged < logLimit) {
        __slog(
          `[dry-run] validate: ${job.id} | ${job.company} | ${parsed.currency ?? 'USD?'} ${Math.round(parsed.min)}-${Math.round(parsed.max)} ${parsed.interval}`,
        )
        logged++
      }
      continue
    }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        salaryMin: BigInt(Math.round(parsed.min)),
        salaryMax: BigInt(Math.round(parsed.max)),
        salaryCurrency: parsed.currency ?? null,
        salaryPeriod: parsed.interval ?? 'year',
        minAnnual: normalized.minAnnual,
        maxAnnual: normalized.maxAnnual,
        currency: normalized.currency,
        isHighSalary: true,
        isHundredKLocal: false,
        ...validation,
      },
    })
    updated++
  }

  __slog('')
  __slog('**Backfill Summary**')
  __slog(`- Parsed (had a salary range): ${parsedCount}`)
  __slog(`- Would validate (high-salary eligible): ${wouldValidate}`)
  __slog(`- Updated: ${updated}`)
  __slog(`- Validation reasons among parsed:`)
  for (const [k, v] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    __slog(`  - ${k}: ${v}`)
  }

  if (!apply) {
    __slog('')
    __slog('Next: re-run with `--apply` to write changes.')
  }
}

main()
  .catch((e) => {
    __serr(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
