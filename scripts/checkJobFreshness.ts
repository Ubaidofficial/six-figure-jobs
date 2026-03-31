import { prisma } from '../lib/prisma'
import { MAX_INDEXABLE_JOB_AGE_DAYS, buildFreshJobWhere } from '../lib/jobs/freshness'
import { buildGlobalExclusionsWhere, buildHighSalaryEligibilityWhere } from '../lib/jobs/queryJobs'

const MAX_ACTIVE_LAST_SEEN_AGE_HOURS = Math.max(
  1,
  Number(process.env.MAX_ACTIVE_LAST_SEEN_AGE_HOURS || '72'),
)

function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60)
}

function pct(n: number, d: number): string {
  return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0.0%'
}

async function main() {
  const eligibleWhere = {
    isExpired: false,
    AND: [buildGlobalExclusionsWhere(), buildHighSalaryEligibilityWhere()],
  } as const

  const freshEligibleWhere = {
    ...eligibleWhere,
    AND: [...eligibleWhere.AND, buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS)],
  } as const

  const [activeJobs, freshIndexableJobs, staleEligibleJobs, newestActive] = await Promise.all([
    prisma.job.count({ where: { isExpired: false } }),
    prisma.job.count({ where: freshEligibleWhere }),
    prisma.job.count({
      where: {
        ...eligibleWhere,
        AND: [
          ...eligibleWhere.AND,
          {
            NOT: buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS),
          },
        ],
      },
    }),
    prisma.job.aggregate({
      where: { isExpired: false },
      _max: { lastSeenAt: true },
    }),
  ])

  const newestLastSeenAt = newestActive._max.lastSeenAt

  console.log('=== Job Freshness Guard ===')
  console.log(`activeJobs=${activeJobs}`)
  console.log(`freshIndexableJobs=${freshIndexableJobs}`)
  console.log(`staleEligibleJobs=${staleEligibleJobs}`)
  console.log(`staleEligiblePct=${pct(staleEligibleJobs, staleEligibleJobs + freshIndexableJobs)}`)

  if (!newestLastSeenAt) {
    throw new Error('No active lastSeenAt timestamp found; scrape freshness cannot be verified')
  }

  const newestAgeHours = hoursSince(newestLastSeenAt)
  console.log(`newestActiveLastSeenAt=${newestLastSeenAt.toISOString()}`)
  console.log(`newestActiveLastSeenAgeHours=${newestAgeHours.toFixed(1)}`)
  console.log(`maxAllowedAgeHours=${MAX_ACTIVE_LAST_SEEN_AGE_HOURS}`)

  if (newestAgeHours > MAX_ACTIVE_LAST_SEEN_AGE_HOURS) {
    throw new Error(
      `Freshness guard failed: newest active job was last seen ${newestAgeHours.toFixed(1)}h ago`,
    )
  }
}

main()
  .catch((error) => {
    console.error('[checkJobFreshness] error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
