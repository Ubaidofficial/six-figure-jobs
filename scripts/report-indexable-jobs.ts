import { prisma } from '../lib/prisma'
import { evaluateJobIndexability } from '../lib/jobs/qualityGate'

type JobRow = {
  id: string
  externalId: string | null
  title: string | null
  roleSlug: string | null
  company: string | null
  companyId: string | null
  locationRaw: string | null
  citySlug: string | null
  countryCode: string | null
  remote: boolean | null
  remoteMode: string | null
  descriptionHtml: string | null
  aiSnippet: string | null
  aiOneLiner: string | null
  salaryValidated: boolean | null
  salaryConfidence: number | null
  minAnnual: bigint | null
  maxAnnual: bigint | null
  currency: string | null
  isExpired: boolean
  lastSeenAt: Date | null
  postedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

async function main() {
  const totalJobs = await prisma.job.count()
  const activeJobs = await prisma.job.count({ where: { isExpired: false } })

  const pageSize = 1000
  let cursorId: string | null = null
  let scanned = 0
  let indexable = 0

  while (true) {
    const rows = (await prisma.job.findMany({
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
      take: pageSize,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        externalId: true,
        title: true,
        roleSlug: true,
        company: true,
        companyId: true,
        locationRaw: true,
        citySlug: true,
        countryCode: true,
        remote: true,
        remoteMode: true,
        descriptionHtml: true,
        aiSnippet: true,
        aiOneLiner: true,
        salaryValidated: true,
        salaryConfidence: true,
        minAnnual: true,
        maxAnnual: true,
        currency: true,
        isExpired: true,
        lastSeenAt: true,
        postedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })) as JobRow[]

    if (rows.length === 0) break

    for (const job of rows) {
      scanned += 1
      if (evaluateJobIndexability(job).indexable) {
        indexable += 1
      }
    }

    cursorId = rows[rows.length - 1].id
  }

  const pctOfTotal = totalJobs > 0 ? Number(((indexable / totalJobs) * 100).toFixed(2)) : 0
  const pctOfActive = activeJobs > 0 ? Number(((indexable / activeJobs) * 100).toFixed(2)) : 0

  console.log(
    JSON.stringify(
      {
        totalJobs,
        activeJobs,
        scanned,
        indexableJobs: indexable,
        pctOfTotal,
        pctOfActive,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error('[report-indexable-jobs] error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
