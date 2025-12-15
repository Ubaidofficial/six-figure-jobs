// scripts/audit-v2.9.ts
import { execSync } from 'node:child_process'
import { PrismaClient, Prisma } from '@prisma/client'
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
  // -----------------------------
  // Static repo checks (no DB)
  // -----------------------------
  try {
    const jobPostingLeaks = sh(`grep -RIn "'@type': 'JobPosting'" app | grep -v "app/job" || true`).trim()
    if (jobPostingLeaks) {
      fail(`JobPosting JSON-LD leak outside app/job:\n${jobPostingLeaks}`)
    }

    const salaryFlagLeaks = sh(
      `grep -RIn "isHundredKLocal: true\\|isHighSalaryLocal: true" app lib/jobs | grep -v "lib/jobs/queryJobs.ts" || true`,
    ).trim()
    if (salaryFlagLeaks) {
      fail(`Salary flag qualification leak:\n${salaryFlagLeaks}`)
    }
  } catch (e: any) {
    fail(`Static audit failed to run: ${e?.message || e}`)
  }

  // -----------------------------
  // DB checks
  // -----------------------------
  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is required for v2.9 audit (needs DB to validate published jobs).')
  }

  const prisma = new PrismaClient()

  // Title bans (best-effort; exact “word boundary” validation is also done in SQL in prod checks)
  const bannedTitleOr: Prisma.JobWhereInput[] = [
    { title: { contains: 'intern', mode: 'insensitive' } },
    { title: { contains: 'internship', mode: 'insensitive' } },
    { title: { contains: 'junior', mode: 'insensitive' } },
    { title: { contains: ' jr', mode: 'insensitive' } }, // catches " X jr " / " jr,"
    { title: { contains: 'jr.', mode: 'insensitive' } }, // catches "jr."
    { title: { contains: 'entry', mode: 'insensitive' } },
    { title: { contains: 'graduate', mode: 'insensitive' } },
    { title: { contains: 'new grad', mode: 'insensitive' } },
    { title: { contains: 'new graduate', mode: 'insensitive' } },
  ]

  // Type bans
  const bannedTypeOr: Prisma.JobWhereInput[] = [
    { type: { contains: 'part-time', mode: 'insensitive' } },
    { type: { contains: 'part time', mode: 'insensitive' } },
    { type: { contains: 'contract', mode: 'insensitive' } },
    { type: { contains: 'temporary', mode: 'insensitive' } },
    { employmentType: { contains: 'part-time', mode: 'insensitive' } },
    { employmentType: { contains: 'part time', mode: 'insensitive' } },
    { employmentType: { contains: 'contract', mode: 'insensitive' } },
    { employmentType: { contains: 'temporary', mode: 'insensitive' } },
  ]

  try {
    // 1) SalaryValidated must be true for any published job
    // NOTE: Prisma types salaryValidated as boolean (non-nullable), so do NOT check for null here.
    const invalidSalaryValidated = await prisma.job.count({
      where: { isExpired: false, salaryValidated: false },
    })
    if (invalidSalaryValidated > 0) {
      fail(`Found ${invalidSalaryValidated} published jobs with salaryValidated=false`)
    }

    // Optional hard guard: if you suspect historical NULLs, raw SQL can detect it.
    // (Safe even if the column is NOT NULL; it will just return 0.)
    const nullSalaryValidated = await prisma.$queryRaw<Array<{ n: bigint }>>`
      select count(*)::bigint as n
      from "Job"
      where "isExpired" = false
        and "salaryValidated" is null
    `
    const nNullSalaryValidated = Number(nullSalaryValidated?.[0]?.n ?? 0n)
    if (nNullSalaryValidated > 0) {
      fail(`Found ${nNullSalaryValidated} published jobs with salaryValidated IS NULL`)
    }

    // 2) Confidence gate
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

    // 3) Banned titles
    const bannedTitle = await prisma.job.count({
      where: { isExpired: false, OR: bannedTitleOr },
    })
    if (bannedTitle > 0) {
      fail(`Found ${bannedTitle} published jobs with banned title keywords`)
    }

    // 4) Banned employment types
    const bannedType = await prisma.job.count({
      where: { isExpired: false, OR: bannedTypeOr },
    })
    if (bannedType > 0) {
      fail(`Found ${bannedType} published jobs with banned employment type keywords`)
    }

    // 5) Currency-aware threshold violations
    for (const [currency, threshold] of Object.entries(HIGH_SALARY_THRESHOLDS)) {
      const belowThreshold = await prisma.job.count({
        where: {
          isExpired: false,
          salaryValidated: true,
          salaryConfidence: { gte: HIGH_SALARY_MIN_CONFIDENCE },
          currency,
          NOT: {
            OR: [{ maxAnnual: { gte: BigInt(threshold) } }, { minAnnual: { gte: BigInt(threshold) } }],
          },
        },
      })
      if (belowThreshold > 0) {
        fail(`Found ${belowThreshold} published ${currency} jobs below threshold ${threshold}`)
      }
    }

    // 6) Hybrid must never be mis-flagged as fully remote
    const hybridMisflaggedRemote = await prisma.job.count({
      where: {
        isExpired: false,
        remoteMode: 'remote',
        locationRaw: { contains: 'hybrid', mode: 'insensitive' },
      },
    })
    if (hybridMisflaggedRemote > 0) {
      fail(
        `Found ${hybridMisflaggedRemote} published jobs with locationRaw containing "hybrid" but remoteMode="remote"`,
      )
    }

    // 7) Remote jobs must have remoteRegion (so remote sitemaps/pages can segment)
    // Prisma typing likely makes remoteRegion non-nullable; so we check '' in Prisma,
    // and also add a raw SQL null-check to be safe.
    const remoteMissingRemoteRegionEmpty = await prisma.job.count({
      where: {
        isExpired: false,
        remote: true,
        remoteMode: 'remote',
        remoteRegion: '',
      },
    })
    if (remoteMissingRemoteRegionEmpty > 0) {
      fail(`Found ${remoteMissingRemoteRegionEmpty} published remote jobs with remoteRegion=""`)
    }

    const remoteMissingRemoteRegionNull = await prisma.$queryRaw<Array<{ n: bigint }>>`
      select count(*)::bigint as n
      from "Job"
      where "isExpired" = false
        and "remote" = true
        and "remoteMode" = 'remote'
        and "remoteRegion" is null
    `
    const nRemoteRegionNull = Number(remoteMissingRemoteRegionNull?.[0]?.n ?? 0n)
    if (nRemoteRegionNull > 0) {
      fail(`Found ${nRemoteRegionNull} published remote jobs with remoteRegion IS NULL`)
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
