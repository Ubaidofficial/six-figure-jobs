import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

// Description-parsed salaries above this threshold are almost always misreads
// (e.g. "$1.5M total comp over 5 years" parsed as $1.5M annual).
const CAP_USD = 600_000n

async function main() {
  __slog(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  __slog(`Cap:  $${CAP_USD.toLocaleString()} USD`)
  __slog('')

  const outliers = await prisma.job.findMany({
    where: {
      salarySource: 'description',
      OR: [
        { minAnnual: { gt: CAP_USD } },
        { maxAnnual: { gt: CAP_USD } },
      ],
    },
    select: {
      id: true,
      title: true,
      company: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      salaryParseReason: true,
    },
    orderBy: { maxAnnual: 'desc' },
  })

  __slog(`Found ${outliers.length} outlier job(s) with description-derived salary > $${CAP_USD.toLocaleString()}`)
  __slog('')

  if (outliers.length === 0) {
    __slog('Nothing to do.')
    return
  }

  for (const job of outliers) {
    const min = job.minAnnual != null ? `$${Number(job.minAnnual).toLocaleString()}` : 'null'
    const max = job.maxAnnual != null ? `$${Number(job.maxAnnual).toLocaleString()}` : 'null'
    __slog(`  [${job.id}] ${job.title} @ ${job.company}  min=${min}  max=${max}  ${job.currency ?? ''}`)
  }

  __slog('')

  if (!APPLY) {
    __slog('Dry run complete — re-run with --apply to commit changes.')
    return
  }

  const ids = outliers.map((j) => j.id)

  const result = await prisma.job.updateMany({
    where: { id: { in: ids } },
    data: {
      minAnnual: null,
      maxAnnual: null,
      salaryMin: null,
      salaryMax: null,
      salaryValidated: false,
      salaryConfidence: 0,
      salaryParseReason: 'capped_description',
    },
  })

  __slog(`Applied: nulled salary on ${result.count} job(s), salaryParseReason='capped_description'`)
}

main()
  .catch((err) => {
    __serr(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
