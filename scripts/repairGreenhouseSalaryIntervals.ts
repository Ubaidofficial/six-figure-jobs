import { format as __format } from 'node:util'

import { prisma } from '../lib/prisma'
import { parseGreenhouseSalary } from '../lib/ingest/greenhouseSalaryParser'
import { shouldPreferParsedGreenhouseSalary } from '../lib/ingest/greenhouseSalaryReconciliation'
import {
  normalizeSalary,
  validateHighSalaryEligibility,
} from '../lib/normalizers/salary'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name)
}

function getArg(name: string): string | null {
  const args = process.argv.slice(2)
  const idx = args.indexOf(name)
  if (idx === -1) return null
  return args[idx + 1] ?? null
}

async function main() {
  const apply = hasFlag('--apply')
  const limit = Number(getArg('--limit') ?? '') || null

  __slog('Repair Greenhouse salary intervals')
  __slog(`Mode : ${apply ? 'APPLY' : 'dry-run'}`)
  __slog(`Limit: ${limit ?? 'none'}`)
  __slog('')

  const jobs = await prisma.job.findMany({
    where: {
      source: 'ats:greenhouse',
      isExpired: false,
      salaryValidated: true,
      OR: [
        {
          AND: [
            { salaryPeriod: { in: ['month', 'week', 'day', 'hour'] } },
            {
              OR: [
                { minAnnual: { gt: BigInt(500000) } },
                { maxAnnual: { gt: BigInt(500000) } },
              ],
            },
          ],
        },
      ],
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: limit ?? undefined,
    select: {
      id: true,
      shortId: true,
      title: true,
      company: true,
      locationRaw: true,
      countryCode: true,
      descriptionHtml: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      salaryPeriod: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      salaryValidated: true,
    },
  })

  __slog(`Loaded ${jobs.length} suspicious Greenhouse jobs`)
  if (jobs.length === 0) return

  let repaired = 0
  let demoted = 0
  let skipped = 0

  for (const job of jobs) {
    const parsed = parseGreenhouseSalary({
      html: job.descriptionHtml,
      locationText: job.locationRaw,
      countryCode: job.countryCode,
    })

    const shouldPrefer = shouldPreferParsedGreenhouseSalary({
      structured: {
        min: job.salaryMin != null ? Number(job.salaryMin) : null,
        max: job.salaryMax != null ? Number(job.salaryMax) : null,
        currency: job.salaryCurrency,
        interval: job.salaryPeriod,
      },
      parsed,
    })

    if (parsed && shouldPrefer) {
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

      __slog(
        `[repair] ${job.company} | ${job.title} | ${job.shortId ?? job.id} | ${job.salaryPeriod ?? 'null'} -> ${parsed.interval ?? 'year'} | ${parsed.currency ?? 'null'} ${Math.round(parsed.min)}-${Math.round(parsed.max)}`,
      )

      if (!apply) {
        repaired++
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
          isHighSalary: validation.salaryValidated === true,
          isHundredKLocal: false,
          salarySource: 'descriptionText',
          ...validation,
        },
      })
      repaired++
      continue
    }

    __slog(
      `[demote] ${job.company} | ${job.title} | ${job.shortId ?? job.id} | unable to recover trusted annual salary`,
    )

    if (!apply) {
      demoted++
      continue
    }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: null,
        minAnnual: null,
        maxAnnual: null,
        currency: null,
        isHighSalary: false,
        isHundredKLocal: false,
        salaryValidated: false,
        salaryConfidence: 0,
        salarySource: 'none',
        salaryParseReason: 'bad_range',
        salaryNormalizedAt: new Date(),
        salaryRejectedAt: new Date(),
        salaryRejectedReason: 'greenhouse-interval-repair-unrecoverable',
        needsReview: false,
      },
    })
    demoted++
  }

  __slog('')
  __slog(`Repaired: ${repaired}`)
  __slog(`Demoted : ${demoted}`)
  __slog(`Skipped : ${skipped}`)
}

main()
  .catch((error) => {
    __serr(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
