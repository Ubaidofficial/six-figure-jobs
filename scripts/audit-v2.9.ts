import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { HIGH_SALARY_THRESHOLDS } from '../lib/currency/thresholds'
import { HIGH_SALARY_MIN_CONFIDENCE } from '../lib/jobs/queryJobs'

function sh(cmd: string): string {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
}

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

async function main() {
  // Static repo checks
  try {
    const jobPostingLeaks = sh("grep -RIn \"'@type': 'JobPosting'\" app | grep -v \"app/job\" || true").trim()
    if (jobPostingLeaks) {
      fail(`JobPosting JSON-LD leak outside app/job:\n${jobPostingLeaks}`)
    }

    const salaryFlagLeaks = sh(
      "grep -RIn \"isHundredKLocal: true\\|isHighSalaryLocal: true\" app lib/jobs | grep -v \"lib/jobs/queryJobs.ts\" || true"
    ).trim()
    if (salaryFlagLeaks) {
      fail(`Salary flag qualification leak:\n${salaryFlagLeaks}`)
    }
  } catch (e: any) {
    fail(`Static audit failed to run: ${e?.message || e}`)
  }

  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is required for v2.9 audit (needs DB to validate published jobs).')
  }

  const prisma = new PrismaClient()

  const bannedTitleOr: any[] = [
    { title: { contains: 'intern', mode: 'insensitive' } },
    { title: { contains: 'junior', mode: 'insensitive' } },
    { title: { contains: 'entry', mode: 'insensitive' } },
    { title: { contains: 'graduate', mode: 'insensitive' } },
    { title: { contains: 'new grad', mode: 'insensitive' } },
    { title: { contains: 'new graduate', mode: 'insensitive' } },
  ]

  const bannedTypeOr: any[] = [
    { type: { contains: 'part-time', mode: 'insensitive' } },
    { type: { contains: 'contract', mode: 'insensitive' } },
    { type: { contains: 'temporary', mode: 'insensitive' } },
    { employmentType: { contains: 'part-time', mode: 'insensitive' } },
    { employmentType: { contains: 'contract', mode: 'insensitive' } },
    { employmentType: { contains: 'temporary', mode: 'insensitive' } },
  ]

  try {
    const invalidSalaryValidated = await prisma.job.count({
      where: {
        isExpired: false,
        salaryValidated: false,
      },
    })
    if (invalidSalaryValidated > 0) {
      fail(`Found ${invalidSalaryValidated} published jobs with salaryValidated=false`)
    }

    const lowConfidence = await prisma.job.count({
      where: {
        isExpired: false,
        salaryValidated: true,
        salaryConfidence: { lt: HIGH_SALARY_MIN_CONFIDENCE },
      },
    })
    if (lowConfidence > 0) {
      fail(`Found ${lowConfidence} published jobs with salaryConfidence<${HIGH_SALARY_MIN_CONFIDENCE}`)
    }

    const bannedTitle = await prisma.job.count({
      where: { isExpired: false, OR: bannedTitleOr },
    })
    if (bannedTitle > 0) {
      fail(`Found ${bannedTitle} published jobs with banned title keywords`)
    }

    const bannedType = await prisma.job.count({
      where: { isExpired: false, OR: bannedTypeOr },
    })
    if (bannedType > 0) {
      fail(`Found ${bannedType} published jobs with banned employment type keywords`)
    }

    // Currency-aware threshold violations
    for (const [currency, threshold] of Object.entries(HIGH_SALARY_THRESHOLDS)) {
      const belowThreshold = await prisma.job.count({
        where: {
          isExpired: false,
          salaryValidated: true,
          salaryConfidence: { gte: HIGH_SALARY_MIN_CONFIDENCE },
          currency,
          NOT: {
            OR: [
              { maxAnnual: { gte: BigInt(threshold) } },
              { minAnnual: { gte: BigInt(threshold) } },
            ],
          },
        },
      })
      if (belowThreshold > 0) {
        fail(`Found ${belowThreshold} published ${currency} jobs below threshold ${threshold}`)
      }
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log('v2.9 audit OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

